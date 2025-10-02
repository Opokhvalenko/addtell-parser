import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import AutoLoad from "@fastify/autoload";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";

import configPlugin from "./config/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export type AppOptions = Partial<FastifyServerOptions>;

function makeLogger(usePretty: boolean) {
  if (!usePretty) return { level: "info" } as const;
  return {
    level: "info",
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

export default async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const isProd = process.env.NODE_ENV === "production";
  const usePretty = !isProd || process.env.PRETTY_LOGS === "1";

  const app = Fastify({
    ...options,
    trustProxy: true,
    logger: makeLogger(usePretty),
    disableRequestLogging: !isProd,
  });

  await app.register(configPlugin);

  await app.register(AutoLoad, {
    dir: join(__dirname, "plugins"),
    ignorePattern: /^(?!.*\.plugin\.(t|j)s$).+/i,
    encapsulate: true,
  });

  await app.register((await import("./modules/auth/routes.js")).default);
  await app.register((await import("./modules/uploads/routes.js")).default);
  await app.register((await import("./modules/feed/routes.js")).default);
  await app.register((await import("./modules/feed/routes.article.js")).default);

  await app.register((await import("./modules/adserver/routes.bid.js")).default, {
    prefix: "/adserver",
  });
  await app.register((await import("./modules/adserver/routes.click.js")).default, {
    prefix: "/adserver",
  });
  await app.register((await import("./modules/adserver/routes.lineitem.js")).default);
  try {
    await app.register((await import("./modules/adserver/routes.stats.js")).default, {
      prefix: "/adserver",
    });
  } catch {
    /* optional */
  }

  app.get("/create", { preHandler: app.authenticate }, async (req, reply) => {
    const { renderCreateLineItem } = await import(
      "./modules/adserver/ssr/pages/create-lineitem.js"
    );
    return reply.type("text/html").send(renderCreateLineItem({ user: req.user }));
  });

  if (!isProd) {
    await app.ready();
    app.log.info(`\n${app.printRoutes()}`);
  }

  return app;
}
