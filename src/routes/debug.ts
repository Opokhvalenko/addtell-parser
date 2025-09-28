import type { FastifyPluginAsync } from "fastify";

const debugRoutes: FastifyPluginAsync = async (app) => {
  app.get("/__routes", async (_req, reply) => {
    reply.type("text/plain").send(app.printRoutes());
  });
};

export default debugRoutes;
