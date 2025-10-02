import { Type } from "@sinclair/typebox";
import type { FastifyPluginAsync } from "fastify";
import { parseArticleByUrl } from "./articleService.js";

const ArticleQuerySchema = Type.Object({
  url: Type.String({ minLength: 6 }),
});

const routes: FastifyPluginAsync = async (app) => {
  app.get("/article", { schema: { querystring: ArticleQuerySchema } }, async (req) => {
    const { url } = req.query as { url: string };
    try {
      return await parseArticleByUrl(app, url);
    } catch (_e) {
      throw app.httpErrors.badGateway("Failed to parse article");
    }
  });
};

export default routes;
