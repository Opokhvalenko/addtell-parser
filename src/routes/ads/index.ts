import type { FastifyPluginAsync } from "fastify";
import adserverRoutes from "../../modules/adserver/routes.js";

const plugin: FastifyPluginAsync = async (app) => {
  app.register(adserverRoutes, { prefix: "/api/ads" });

  app.get("/api/ads/demo", async (_req, reply) => {
    return reply.send({
      ok: true,
      note: "demo endpoint for ads page",
      time: new Date().toISOString(),
    });
  });

  app.get("/api/ads-debug", async (_req, reply) => {
    return reply.send({ events: [] });
  });

  app.register(adserverRoutes, { prefix: "/adserver" });
};

export default plugin;
