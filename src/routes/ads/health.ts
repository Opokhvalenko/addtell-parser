import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../../adserver/http/auth.js";

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", { preHandler: requireAuth }, async (_req, reply) => {
    let dbOk = true;
    try {
      await app.prisma.requestCounter.findFirst({});
    } catch {
      dbOk = false;
    }

    reply.send({
      ok: dbOk && !!app.md,
      db: dbOk,
      md: !!app.md,
      uploadsDir: process.env.UPLOADS_DIR ?? "uploads",
      now: new Date().toISOString(),
      version: app.version ?? "unknown",
    });
  });
};

export default healthRoutes;
