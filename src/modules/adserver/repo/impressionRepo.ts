import type { FastifyInstance } from "fastify";

export function impressionRepo(app: FastifyInstance) {
  return {
    add: (uid: string, lineItemId: string) =>
      app.prisma.impression.create({ data: { uid, lineItemId } }),
    countSince: (uid: string, lineItemId: string, since: Date) =>
      app.prisma.impression.count({ where: { uid, lineItemId, at: { gte: since } } }),
  };
}
