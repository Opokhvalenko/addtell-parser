import type { FastifyInstance } from "fastify";

type RequestStatModel = {
  create: (args: {
    data: { route: string; startedAt: Date; ms: number; ok: boolean; note?: string | null };
  }) => Promise<unknown>;
};
function hasRequestStat(p: unknown): p is { requestStat: RequestStatModel } {
  return (
    !!p && typeof (p as { requestStat?: { create?: unknown } }).requestStat?.create === "function"
  );
}

export async function logStat(app: FastifyInstance, route: string, t0: number, ok: boolean) {
  const ms = Date.now() - t0;
  try {
    if (hasRequestStat(app.prisma)) {
      await app.prisma.requestStat.create({ data: { route, startedAt: new Date(t0), ms, ok } });
    } else {
      app.log.debug("requestStat model not present, skipping");
    }
  } catch (err) {
    app.log.warn({ err }, "requestStat create skipped");
  }
}
