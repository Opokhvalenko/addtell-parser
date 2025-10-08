import type { FastifyPluginAsync } from "fastify";
import adserverRoutes from "../../modules/adserver/routes.js";

const plugin: FastifyPluginAsync = async (app) => {
  app.register(adserverRoutes, { prefix: "/adserver" });
};

export default plugin;
