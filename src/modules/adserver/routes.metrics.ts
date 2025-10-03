import type { FastifyPluginAsync } from "fastify";
import { statsRepo } from "./repo/statsRepo.js";

const metricsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/metrics/today", async (_req, reply) => {
    const stats = await statsRepo(app).today();
    return reply.send(stats);
  });

  app.get("/stats", async (_req, reply) => {
    return reply.redirect("/adserver/metrics/today", 302);
  });
};

export default metricsRoutes;
