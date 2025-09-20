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
    logger: isDev
      ? {
          transport: { target: "pino-pretty", options: { translateTime: "SYS:standard" } },
          level: "info",
        }
      : true,
  });

  await fastify.register(configPlugin);

  await fastify.register(AutoLoad, { dir: join(__dirname, "plugins"), options });

  await fastify.register(AutoLoad, { dir: join(__dirname, "routes"), options });

  fastify.get("/", async () => ({ hello: "world" }));
  return fastify;
}

export default buildApp;
