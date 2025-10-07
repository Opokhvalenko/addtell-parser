import type { FastifyPluginAsync } from "fastify";
import bidRoutes from "../../modules/adserver/routes.bid.js";
import clickRoutes from "../../modules/adserver/routes.click.js";
import statsRoutes from "../../modules/adserver/routes.metrics.js";

const plugin: FastifyPluginAsync = async (app) => {
  app.register(bidRoutes, { prefix: "/adserver" });
  app.register(clickRoutes, { prefix: "/adserver" });
  app.register(statsRoutes, { prefix: "/adserver" });
};

export default plugin;
