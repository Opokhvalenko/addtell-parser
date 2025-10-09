import "./telemetry/index.js";

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import AutoLoad from "@fastify/autoload";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import configPlugin from "./config/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
export type AppOptions = Partial<FastifyServerOptions>;

function makeLogger(usePretty: boolean) {
  const level = process.env.LOG_LEVEL ?? "info";
  if (!usePretty) return { level } as const;
  try {
    require.resolve("pino-pretty");
  } catch {
    return { level } as const;
  }
  return {
    level,
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "SYS:standard",
        singleLine: true,
        colorize: true,
        ignore: "pid,hostname",
        levelFirst: true,
      },
    },
  } as const;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const isProd = process.env.NODE_ENV === "production";
  const usePretty = !isProd || process.env.PRETTY_LOGS === "1";

  const app = Fastify({
    ...options,
    trustProxy: true,
    logger: makeLogger(usePretty),
    disableRequestLogging: !isProd,
  });

  // 1) config
  await app.register(configPlugin);

  // 2) базові плагіни
  await app.register((await import("./plugins/otel.plugin.js")).default);
  await app.register((await import("./plugins/health.plugin.js")).default);
  await app.register((await import("./plugins/security-headers.plugin.js")).default);
  await app.register((await import("./plugins/rate-limit.plugin.js")).default);
  await app.register((await import("./plugins/audit-logging.plugin.js")).default);

  // core-auth раніше за всі роути
  await app.register((await import("./plugins/jwt.plugin.js")).default);
  await app.register((await import("./plugins/auth.plugin.js")).default);

  // аналітика (один раз)
  await app.register((await import("./plugins/analytics.plugin.js")).default);

  // інші плагіни через автолоад (ігноруємо ті, що вже підняли)
  await app.register(AutoLoad, {
    dir: join(__dirname, "plugins"),
    ignorePattern:
      /^(otel|health|security-headers|rate-limit|audit-logging|jwt|auth|analytics|cookie)\.plugin\.(js|mjs|cjs)$/i,
    encapsulate: true,
  });

  // демо-роути
  await app.register((await import("./routes/beautiful-ad.js")).default, { prefix: "/api" });

  // друк карти маршрутів (локально завжди; у прод — якщо PRINT_ROUTES=1)
  if (!isProd || process.env.PRINT_ROUTES === "1") {
    await app.ready();
    app.log.info(`\n${app.printRoutes()}`);
  }

  return app;
}
