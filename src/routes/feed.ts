import type { FastifyPluginAsync } from "fastify";
import type { FromSchema } from "json-schema-to-ts";
import { getOrParseFeed } from "../services/feedService.js";
import { normalizeError } from "../utils/errors.js";

const QuerySchema = {
  type: "object",
  properties: {
    url: { type: "string", format: "uri" },
    force: { type: "string", enum: ["1"] },
  },
  additionalProperties: false,
} as const;

type Query = FromSchema<typeof QuerySchema>;

const feedRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: Query;
  }>(
    "/feed",
    {
      schema: {
        querystring: QuerySchema,
      },
    },
    async (req, reply) => {
      fastify.log.info({ query: req.query }, "GET /feed: incoming");

      const url = req.query.url ?? fastify.config.DEFAULT_FEED_URL;
      if (!url) {
        throw fastify.httpErrors.badRequest("DEFAULT_FEED_URL is not set");
      }

      const force = req.query.force === "1";

      try {
        const data = await getOrParseFeed(fastify, url, force);
        fastify.log.info({ url, items: data.items?.length ?? 0 }, "GET /feed: ok");
        return { url, ...data };
      } catch (e: unknown) {
        const err = normalizeError(e);
        fastify.log.error({ url, errName: err.name, errMsg: err.message }, "GET /feed: failed");
        return reply.code(502).send({ error: "Failed to fetch feed", message: err.message });
      }
    },
  );
};

export default feedRoutes;
