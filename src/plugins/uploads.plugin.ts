import fp from "fastify-plugin";
import uploadsRoutes from "../modules/uploads/routes.js";

export default fp(
  async (app) => {
    await app.register(uploadsRoutes, { prefix: "/api" });
    app.log.info("Uploads plugin registered");
  },
  {
    name: "uploads",
    dependencies: [],
  },
);
