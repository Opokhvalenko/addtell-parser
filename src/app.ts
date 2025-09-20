import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import AutoLoad from "@fastify/autoload";
import Sensible from "@fastify/sensible";
import Fastify, { type FastifyServerOptions } from "fastify";

import configPlugin from "./config/index.js";
import { ajvFormatsPlugin } from "./lib/ajvFormatsPlugin.js";
import errorHandlerPlugin from "./plugins/error-handler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export type AppOptions = Partial<FastifyServerOptions>;

async function buildApp(options: AppOptions = {}) {
  const isDev = process.env.NODE_ENV !== "production";

  const fastify = Fastify({
    logger: isDev
      ? {
          level: "info",
          transport: {
            target: "pino-pretty",
            options: { translateTime: "SYS:standard", singleLine: true, colorize: true },
          },
        }
      : { level: "info" },

    ajv: {
      customOptions: {
        allErrors: true,
        coerceTypes: true,
        removeAdditional: true,
      },
      plugins: [ajvFormatsPlugin],
    },

    ...options,
  });

  await fastify.register(configPlugin);
  await fastify.register(Sensible);
  await fastify.register(errorHandlerPlugin);

  await fastify.register(AutoLoad, {
    dir: join(__dirname, "plugins"),
    encapsulate: false,
    ignorePattern: /(^_|\.d\.ts$)/i,
  });

  await fastify.register(AutoLoad, {
    dir: join(__dirname, "routes"),
    encapsulate: false,
    ignorePattern: /(^_|\.d\.ts$)/i,
    routeParams: true,
    maxDepth: 2,
  });

  fastify.get("/", async () => ({ hello: "world" }));
  return fastify;
}

export default buildApp;
