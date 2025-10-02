import type { FastifyInstance } from "fastify";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export function metricsRepo(app: FastifyInstance) {
  return {
    add: (
      kind: string,
      data: {
        uid?: string | null;
        lineItemId?: string | null;
        tookMs?: number | null;
        extra?: Json;
      },
    ) =>
      app.prisma.adEvent.create({
        data: {
          kind,
          uid: data.uid ?? null,
          lineItemId: data.lineItemId ?? null,
          tookMs: data.tookMs ?? null,
          extra: (data.extra ?? null) as Json,
        },
      }),

    incr: async (key: string, by = 1) => {
      const doc = await app.prisma.requestCounter.findUnique({ where: { key } });
      if (!doc) return app.prisma.requestCounter.create({ data: { key, value: by } });
      return app.prisma.requestCounter.update({ where: { key }, data: { value: doc.value + by } });
    },
  };
}
