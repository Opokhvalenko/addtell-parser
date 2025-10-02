import type { FastifyPluginAsync } from "fastify";
import { statsRepo } from "./repo/statsRepo.js";

const statsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/stats", async (_req, reply) => {
    const stats = await statsRepo(app).today();
    reply.send(stats);
  });
};

export default statsRoutes;
