import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getOrParseFeed } from "../services/feedService.js";

const feedRoutes: FastifyPluginAsync = async (fastify) => {
  const Query = z.object({
    url: z.string().url().optional(),
    force: z.string().optional(),
  });

  fastify.get("/feed", async (req, reply) => {
    fastify.log.info({ query: req.query }, "GET /feed: incoming");

    const parsed = Query.safeParse(req.query);
    if (!parsed.success) {
      fastify.log.warn({ issues: parsed.error.issues }, "GET /feed: bad query");
      return reply.code(400).send({
        error: "Bad Request",
        details: parsed.error.issues,
      });
    }

    const url = parsed.data.url ?? fastify.config.DEFAULT_FEED_URL;
    if (!url) {
      fastify.log.warn("GET /feed: DEFAULT_FEED_URL is not set");
      return reply.code(400).send({ error: "DEFAULT_FEED_URL is not set" });
    }

    const force = parsed.data.force === "1";

    try {
      const data = await getOrParseFeed(fastify, url, force);
      fastify.log.info({ url, items: data.items?.length ?? 0 }, "GET /feed: ok");
      return { url, ...data };
    } catch (e: any) {
      fastify.log.error({ url, errName: e?.name, errMsg: e?.message }, "GET /feed: failed");
      return reply
        .code(502)
        .send({ error: "Failed to fetch feed", message: String(e?.message ?? e) });
    }
  });
};

export default feedRoutes;