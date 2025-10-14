import fp from "fastify-plugin";
import authRoutes from "../modules/auth/routes.js";

export default fp(
  async (app) => {
    await app.register(authRoutes, { prefix: "/auth" });
    await app.register(authRoutes, { prefix: "/api/auth" });
    app.log.info("Auth routes mounted at /auth and /api/auth");
  },
  { name: "auth-routes", dependencies: ["jwt"] },
);
