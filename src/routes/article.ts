import type { FastifyPluginAsync } from "fastify";
import {
  type ArticleQuery,
  ArticleQuerySchema,
  type ArticleResponse,
  ArticleResponseSchema,
} from "../schemas/article.js";
import { parseArticleByUrl } from "../services/articleService.js";
import { withRetry } from "../utils/retry.js";

const articleRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: ArticleQuery; Reply: ArticleResponse }>(
    "/article",
    {
      schema: { querystring: ArticleQuerySchema, response: { 200: ArticleResponseSchema } },
      preHandler: [fastify.authenticate],
    },
    async (req, reply) => {
      try {
        const url = req.query.url;
        const parsed = await withRetry(() => parseArticleByUrl(fastify, url), 2, 400);
        return {
          url: parsed.canonicalUrl ?? parsed.url,
          title: parsed.title ?? "",
          content: parsed.content ?? "",
        };
      } catch (err) {
        fastify.log.error({ err }, "article parse failed");
        return reply.badGateway("Failed to parse article");
      }
    },
  );
};

export default articleRoutes;
