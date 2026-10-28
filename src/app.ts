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
const DEFAULT_TRUST_PROXY_HOPS = 1;

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
    // Render puts exactly one proxy in front of the app. `true` would trust every
    // X-Forwarded-For entry, so clients could pick their own IP (and rate-limit key).
    trustProxy: Number(process.env.TRUST_PROXY_HOPS ?? DEFAULT_TRUST_PROXY_HOPS),
    logger: makeLogger(usePretty),
    disableRequestLogging: !isProd,
    pluginTimeout: 30000,
  });

  await app.register(configPlugin);
  // First: Fastify copies the error handler into a plugin's context when the plugin is
  // registered, so anything registered earlier would keep the default one, which sends
  // internal error messages (hostnames, driver errors) to the client
  await app.register((await import("./plugins/error-handling.plugin.js")).default);

  await app.register((await import("./plugins/swagger.plugin.js")).default);

  await app.register((await import("./plugins/otel.plugin.js")).default);
  await app.register((await import("./plugins/health.plugin.js")).default);
  await app.register((await import("./plugins/security-headers.plugin.js")).default);
  await app.register((await import("./plugins/rate-limit.plugin.js")).default);
  await app.register((await import("./plugins/audit-logging.plugin.js")).default);

  await app.register((await import("./plugins/jwt.plugin.js")).default);
  await app.register((await import("./plugins/cookie.plugin.js")).default);
  await app.register((await import("./plugins/auth.plugin.js")).default);
  await app.register((await import("./plugins/clickhouse.plugin.js")).default);
  await app.register((await import("./plugins/analytics.plugin.js")).default);

  await app.register(AutoLoad, {
    dir: join(__dirname, "plugins"),
    ignorePattern:
      /^(error-handling|otel|health|security-headers|rate-limit|audit-logging|jwt|auth|clickhouse|analytics|cookie|swagger)\.plugin\.(js|mjs|cjs|ts|mts|cts)$/i,
    encapsulate: true,
  });

  await app.register((await import("./routes/beautiful-ad.js")).default, { prefix: "/api" });

  if (!isProd || process.env.PRINT_ROUTES === "1") {
    await app.ready();
    app.log.info(`\n${app.printRoutes()}`);
  }

  return app;
}
