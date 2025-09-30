import type { FastifyInstance } from "fastify";
import { getOrParseFeed } from "../../services/feedService.js";
import { adminGuard } from "./guard.js";
import { AdminHeader, ErrorResponse, RefreshQuery, RefreshResponse } from "./schemas.js";

export default async function refreshRoutes(app: FastifyInstance) {
  app.get(
    "/refresh",
    {
      preHandler: adminGuard,
      schema: {
        tags: ["Admin"],
        summary: "Запустити синхронізацію фідів зараз",
        description: "Якщо передати ?url=..., оновиться лише вказаний фід.",
        headers: AdminHeader,
        querystring: RefreshQuery,
        response: { 200: RefreshResponse, 401: ErrorResponse, 503: ErrorResponse },
      },
    },
    async (req, reply) => {
      if (!app.cronFeedsRun) {
        return reply.code(503).send({ error: "cron disabled" });
      }

      const { url } = (req.query ?? {}) as { url?: string };
      if (url) {
        await getOrParseFeed(app, url, /* force */ true);
        return { ok: true, only: url };
      }

      await app.cronFeedsRun();
      return { ok: true };
    },
  );
}
