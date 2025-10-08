import fp from "fastify-plugin";
import analyticsRoutes from "../modules/analytics/routes.js";

export default fp(
  async (app) => {
    await app.register(analyticsRoutes, { prefix: "/api" });
    app.log.info("Analytics plugin registered");
  },
  { name: "analytics" },
);
