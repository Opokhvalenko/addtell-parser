import type { FastifyPluginAsync } from "fastify";
import { parseArticleByUrl } from "./articleService.js";
import { ArticleQuerySchema } from "./schemas.js";

const routes: FastifyPluginAsync = async (app) => {
  app.log.info("Registering article routes");
  app.get("/article", { schema: { querystring: ArticleQuerySchema } }, async (req) => {
    const { url } = req.query as { url: string };
    try {
      return await parseArticleByUrl(app, url);
    } catch (_e) {
      throw new Error("Failed to parse article");
    }
  });
  app.log.info("Article routes registered");
};

export default routes;
