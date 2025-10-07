import fp from "fastify-plugin";
import analyticsRoutes from "../modules/analytics/routes.js";

export default fp(
  async (app) => {
    await app.register(analyticsRoutes);
    app.log.info("Analytics plugin registered");
  },
  { name: "analytics" },
);
