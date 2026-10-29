import fp from "fastify-plugin";
import authRoutes from "../modules/auth/routes.js";

export default fp(
  async (app) => {
    // One mount: a second copy of the routes would also get its own login limits, doubling the
    // attempts anyone can make on an account
    await app.register(authRoutes, { prefix: "/api/auth" });
  },
  { name: "auth-routes", dependencies: ["jwt"] },
);
