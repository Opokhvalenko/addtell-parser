import fp from "fastify-plugin";
import adserverRoutes from "../modules/adserver/routes.js";

export default fp(
  async (app) => {
    await app.register(adserverRoutes, { prefix: "/api" });
    app.log.info("AdServer plugin registered");
  },
  {
    name: "adserver",
    dependencies: [],
  },
);
