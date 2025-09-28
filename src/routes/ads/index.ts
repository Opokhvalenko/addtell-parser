import type { FastifyPluginAsync } from "fastify";
import adminRoutes from "./admin.js";
import bidRoutes from "./bid.js";
import clickRoutes from "./click.js";
import healthRoutes from "./health.js";
import statsRoutes from "./stats.js";

const plugin: FastifyPluginAsync = async (app) => {
  // адмінка/створення line item
  app.register(adminRoutes, { prefix: "/admin/ads" });
  app.register(healthRoutes, { prefix: "/admin/ads" });

  // API adserver
  app.register(bidRoutes, { prefix: "/adserver" });
  app.register(clickRoutes, { prefix: "/adserver" });
  app.register(statsRoutes, { prefix: "/adserver" });
};

export default plugin;
