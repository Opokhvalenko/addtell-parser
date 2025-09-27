import type { FastifyInstance } from "fastify";
import { humanDuration } from "../../lib/time.js";
import { adminGuard } from "./guard.js";
import { AdminHeader, ErrorResponse, StatusResponse } from "./schemas.js";

export default async function statusRoutes(app: FastifyInstance) {
  app.get(
    "/status",
    {
      preHandler: adminGuard,
      schema: {
        tags: ["Admin"],
        summary: "Статус крону фідів",
        description:
          "Uptime процесу, остання помилка, лічильники, та тривалості останніх N циклів.",
        headers: AdminHeader,
        response: { 200: StatusResponse, 401: ErrorResponse, 503: ErrorResponse },
      },
    },
    async (_req, reply) => {
      if (!app.cronFeedsStatus) {
        return reply.code(503).send({ error: "cron disabled" });
      }
      const s = app.cronFeedsStatus();
      const uptimeMs = Date.now() - s.processStartedAt.getTime();
      const lastError = s.lastError ? { ...s.lastError, at: s.lastError.at.toISOString() } : null;

      return {
        schedule: s.schedule,
        timezone: s.timezone,
        sources: s.sources,
        outPath: s.outPath,
        take: s.take,
        historyLimit: s.historyLimit,
        cycles: s.cycles,

        processStartedAt: s.processStartedAt.toISOString(),
        uptimeMs,
        uptimeHuman: humanDuration(uptimeMs),

        lastStartedAt: s.lastStartedAt?.toISOString() ?? null,
        lastFinishedAt: s.lastFinishedAt?.toISOString() ?? null,

        lastOk: s.lastOk,
        lastFail: s.lastFail,
        lastDurationMs: s.lastDurationMs,
        durations: s.durations,

        lastError,
      };
    },
  );
}
