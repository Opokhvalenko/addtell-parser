// src/app.ts
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import AutoLoad from "@fastify/autoload";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";

import configPlugin from "./config/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export type AppOptions = Partial<FastifyServerOptions>;

export default async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const isDev = process.env.NODE_ENV !== "production";

  const fastify = Fastify({
    ...options,
    logger: isDev
      ? {
          level: "info",
          transport: {
            target: "pino-pretty",
            options: { translateTime: "SYS:standard", singleLine: true, colorize: true },
          },
        }
      : { level: "info" },
    disableRequestLogging: isDev,
    // УВАГА: не чіпаємо тут ajv.customOptions — усе робить configPlugin
  });

  // 1) ENV + ajv-formats усередині конфіг-плагіна
  await fastify.register(configPlugin);

  // 2) Plugins (prisma, jwt, swagger, sensible, loaded-marker...)
  await fastify.register(AutoLoad, {
    dir: join(__dirname, "plugins"),
    encapsulate: false,
    ignorePattern: /(^_|\.d\.ts$|\.test\.ts$)/i,
  });

  // 3) Routes
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
