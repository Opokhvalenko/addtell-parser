import type { FastifyInstance } from "fastify";
export function lineItemRepo(app: FastifyInstance) {
  return {
    findCandidates: (opts: { size: string; adType: string }) =>
      app.prisma.lineItem.findMany({
        where: {
          active: true,
          adType: opts.adType,
          sizes: { has: opts.size },
        },
        include: { creative: true },
        orderBy: [{ maxCpm: "desc" }, { createdAt: "desc" }],
        take: 50,
      }),
  };
}
