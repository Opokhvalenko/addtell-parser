import type { FastifyPluginAsync } from "fastify";
import {
  type FeedItemResponse,
  type FeedResponse,
  FeedResponseSchema,
  type Query,
  QuerySchema,
} from "../schemas/feed.js";
import { getOrParseFeed } from "../services/feedService.js";
import { normalizeError, toStr } from "../utils/index.js";

const normalizeItem = (i: unknown): FeedItemResponse => {
  const o = (i ?? {}) as Record<string, unknown>;

  const base = {
    id: toStr(o.id),
    feedId: toStr(o.feedId),
    title: toStr(o.title),
    link: toStr(o.link),
    pubDate: toStr(o.pubDate),
    createdAt: toStr(o.createdAt),
  };

  return {
    ...base,
    ...(typeof o.guid === "string" ? { guid: o.guid } : {}),
    ...(typeof o.content === "string" ? { content: o.content } : {}),
  };
};

const feedRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: Query;
    Reply: FeedResponse;
  }>(
    "/feed",
    {
      schema: {
        querystring: QuerySchema,
        response: { 200: FeedResponseSchema },
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

        const title =
          data && typeof (data as { title?: unknown }).title === "string"
            ? (data as { title?: string }).title
            : undefined;

        const rawItems =
          data && Array.isArray((data as { items?: unknown }).items)
            ? ((data as { items?: unknown[] }).items as unknown[])
            : [];

        const items: FeedResponse["items"] = rawItems.map(normalizeItem);

        const body: FeedResponse = { url, items };
        if (title) body.title = title;

        fastify.log.info({ url, items: items.length }, "GET /feed: ok");
        return body;
      } catch (e: unknown) {
        const err = normalizeError(e);
        fastify.log.error({ url, errName: err.name, errMsg: err.message }, "GET /feed: failed");

        return reply
          .code(502)
          .send({ url, items: [], title: "Failed to fetch feed" } satisfies FeedResponse);
      }
    },
  );
};

export default feedRoutes;
