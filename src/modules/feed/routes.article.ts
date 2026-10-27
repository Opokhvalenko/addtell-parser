import type { FastifyPluginAsync } from "fastify";
import { UnsafeUrlError } from "../../utils/safe-fetch.js";
import { parseArticleByUrl } from "./articleService.js";
import { ArticleQuerySchema } from "./schemas.js";

const routes: FastifyPluginAsync = async (app) => {
  app.log.info("Registering article routes");
  app.get(
    "/article",
    // Signed-in users only: the server fetches the URL on the caller's behalf
    { schema: { querystring: ArticleQuerySchema } },
    async (req) => {
      const { url } = req.query as { url: string };
      try {
        return await parseArticleByUrl(app, url);
      } catch (error) {
        if (error instanceof UnsafeUrlError) throw app.httpErrors.badRequest(error.message);
        throw new Error("Failed to parse article");
      }
    },
  );
  app.log.info("Article routes registered");
};

export default routes;
