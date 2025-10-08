import fp from "fastify-plugin";
import feedRoutes from "../modules/feed/routes.js";

export default fp(
  async (app) => {
    app.log.info("Registering feed plugin");
    await app.register(feedRoutes, { prefix: "/api" });
    app.log.info("Feed plugin registered");
  },
  {
    name: "feed",
    dependencies: [],
  },
);
