import type { FastifyInstance } from "fastify";
export function statsRepo(app: FastifyInstance) {
  return {
    async today() {
      const now = new Date();
      const from = new Date(now);
      from.setUTCHours(0, 0, 0, 0);
      const [requests, filled, empty, clicks, impressions, avg] = await Promise.all([
        app.prisma.adEvent.count({ where: { kind: "bid_request", at: { gte: from } } }),
        app.prisma.adEvent.count({ where: { kind: "bid_filled", at: { gte: from } } }),
        app.prisma.adEvent.count({ where: { kind: "bid_empty", at: { gte: from } } }),
        app.prisma.adEvent.count({ where: { kind: "click", at: { gte: from } } }),
        app.prisma.impression.count({ where: { at: { gte: from } } }),
        app.prisma.adEvent.aggregate({
          _avg: { tookMs: true },
          where: { kind: "bid_filled", at: { gte: from } },
        }),
      ]);
      return {
        period: { from: from.toISOString(), to: now.toISOString() },
        requests,
        filled,
        empty,
        impressions,
        clicks,
        avgFillMs: avg._avg?.tookMs ?? null,
        fillRate: requests ? filled / requests : null,
      };
    },
  };
}
