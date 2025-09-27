import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import AutoLoad from "@fastify/autoload";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";

import configPlugin from "./config/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export type AppOptions = Partial<FastifyServerOptions>;

export default async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const isDev = process.env.NODE_ENV !== "production";
  const prettyLogs = isDev || process.env.PRETTY_LOGS === "1";

  const fastify = Fastify({
    ...options,
    trustProxy: true,
    logger: prettyLogs
      ? {
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
        }
      : { level: "info" },
    disableRequestLogging: process.env.NODE_ENV !== "production",
  });

  // env/config
  await fastify.register(configPlugin);

  await fastify.register(AutoLoad, {
    dir: join(__dirname, "plugins"),
    encapsulate: false,
    ignorePattern: /(^_|\.d\.ts$|\.test\.ts$)/i,
  });

  // autoload routes
  await fastify.register(AutoLoad, {
    dir: join(__dirname, "routes"),
    encapsulate: false,
    ignorePattern: /(^_|\.d\.ts$|\.test\.ts$)/i,
    routeParams: true,
    maxDepth: 2,
  });

  fastify.get("/", async () => ({ hello: "world" }));

  return fastify;
}
