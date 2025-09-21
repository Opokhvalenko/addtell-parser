import { PrismaClient } from "@prisma/client";
import fp from "fastify-plugin";

export default fp(async (fastify) => {
  const prisma = new PrismaClient();
  await prisma.$connect();

  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async (app) => {
    await app.prisma.$disconnect();
  });
});
