import fp from "fastify-plugin";
import authRoutes from "../modules/auth/routes.js";

export default fp(
  async (app) => {
    await app.register(authRoutes, { prefix: "/api/auth" });
    app.log.info("Auth plugin registered");
  },
  { name: "auth-routes", dependencies: ["jwt"] },
);
