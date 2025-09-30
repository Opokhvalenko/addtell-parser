import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

import refresh from "./refresh.js";
import status from "./status.js";

export default fp(
  async function adminFeedsRoutes(app: FastifyInstance) {
    // Префіксуємо тут, щоб у дочірніх файлах були шляхи "/refresh" і "/status"
    await app.register(refresh, { prefix: "/admin/feeds" });
    await app.register(status, { prefix: "/admin/feeds" });
  },
  { name: "admin-feeds-routes" },
);
