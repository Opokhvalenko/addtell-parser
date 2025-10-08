import fp from "fastify-plugin";
import pagesRoutes from "../routes/pages/index.js";

export default fp(
  async (app) => {
    await app.register(pagesRoutes);
    app.log.info("Pages plugin registered");
  },
  {
    name: "pages",
    dependencies: [],
  },
);
