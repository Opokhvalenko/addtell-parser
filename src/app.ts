import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import AutoLoad from "@fastify/autoload";
import Fastify, { type FastifyError, type FastifyServerOptions } from "fastify";

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

  // Глобальний error handler (без any)
  fastify.setErrorHandler((err: FastifyError, _req, reply) => {
    const status = typeof err.statusCode === "number" ? err.statusCode : 500;
    reply.code(status).send({ error: err.name, message: err.message });
  });

  // Автолоад плагінів
  await fastify.register(AutoLoad, {
    dir: join(__dirname, "plugins"),
    options,
  });

  // Автолоад роутів
  await fastify.register(AutoLoad, {
    dir: join(__dirname, "routes"),
    options,
  });

  // Проста перевірка
  fastify.get("/", async () => ({ hello: "world" }));

  return fastify;
}

export default buildApp;
