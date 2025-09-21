import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import AutoLoad from "@fastify/autoload";
import Fastify, { type FastifyServerOptions } from "fastify";

import configPlugin from "./config/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export type AppOptions = Partial<FastifyServerOptions>;

async function buildApp(options: AppOptions = {}) {
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

    ajv: {
      customOptions: {
        allErrors: true,
        coerceTypes: true,
        removeAdditional: true,
      },
    },
  });

  await fastify.register(configPlugin);

  await fastify.register(AutoLoad, {
    dir: join(__dirname, "plugins"),
    encapsulate: false,
    ignorePattern: /(^_|\.d\.ts$|\.test\.ts$)/i,
  });

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

export default buildApp;
