import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getOrParseFeed } from "../services/feedService.js";

const feedRoutes: FastifyPluginAsync = async (fastify) => {
  const Query = z.object({
    url: z.string().url().optional(),
    force: z.string().optional(), // expects "1" to force
  });

  fastify.get("/feed", async (req, reply) => {
    const parsed = Query.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Bad Request",
        details: parsed.error.issues,
      });
    }

    const url = parsed.data.url ?? process.env.DEFAULT_FEED_URL;
    if (!url) return reply.code(400).send({ error: "DEFAULT_FEED_URL is not set" });

    const force = parsed.data.force === "1";

    try {
      const data = await getOrParseFeed(fastify, url, force);
      return { url, ...data };
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({ error: "Failed to fetch feed" });
    }
  });
};

export default feedRoutes;
