import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";

export function getPrisma(app: FastifyInstance): PrismaClient {
  return app.prisma;
}
