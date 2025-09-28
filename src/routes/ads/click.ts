import type { FastifyPluginAsync } from "fastify";
import { metricsRepo } from "../../adserver/repo/metricsRepo.js";

const clickRoutes: FastifyPluginAsync = async (app) => {
  app.get("/click", async (req, reply) => {
    const q = req.query as { li?: string; uid?: string };
    await metricsRepo(app).add("click", {
      uid: (q.uid ?? "anon").toString(),
      lineItemId: q.li?.toString() ?? null,
    });
    reply.code(204).send();
  });
};

export default clickRoutes;
