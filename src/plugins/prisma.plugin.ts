import { PrismaClient } from "@prisma/client";
import fp from "fastify-plugin";

export default fp(
  async (fastify) => {
    const env = fastify.config?.NODE_ENV ?? "development";
    const isProd = env === "production";

    const prisma = new PrismaClient({
      log: isProd ? ["warn", "error"] : ["query", "info", "warn", "error"],
    });

    try {
      await prisma.$connect();
      fastify.log.info("Prisma connected");
    } catch (err) {
      fastify.log.error({ err }, "Prisma connect failed");
      throw err;
    }

    fastify.decorate("prisma", prisma);

    fastify.addHook("onClose", async (app) => {
      try {
        await app.prisma.$disconnect();
        fastify.log.info("Prisma disconnected");
      } catch (err) {
        fastify.log.error({ err }, "Prisma disconnect failed");
      }
    });

    fastify.pluginLoaded?.("prisma");
  },
  { name: "prisma" },
);
