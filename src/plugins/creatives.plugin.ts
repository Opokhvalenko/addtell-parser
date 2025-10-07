import fp from "fastify-plugin";
import creativesRoutes from "../modules/creatives/routes.js";

export default fp(
  async (app) => {
    await app.register(creativesRoutes, { prefix: "/api" });
    app.log.info("Creatives plugin registered");
  },
  {
    name: "creatives",
    dependencies: [],
  },
);
