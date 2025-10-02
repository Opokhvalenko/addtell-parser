import type { FastifyPluginAsync } from "fastify";
import { normalizeError } from "../../utils/errors.js";
import { getOrParseFeed } from "./feedService.js";
import {
  type FeedItemResponse,
  type FeedQuery,
  FeedQuerySchema,
  type FeedResponse,
  FeedResponseSchema,
} from "./schemas.js";

function toStr(x: unknown): string {
  if (typeof x === "string") return x;
  if (x == null) return "";
  return String(x);
}

function normalizeItem(i: unknown): FeedItemResponse {
  const o = (i ?? {}) as Record<string, unknown>;
  const out: FeedItemResponse = {
    id: toStr(o.id),
    feedId: toStr(o.feedId),
    title: toStr(o.title),
    link: toStr(o.link),
    pubDate: toStr(o.pubDate),
    createdAt: toStr(o.createdAt),
  };
  if (typeof o.guid === "string") out.guid = o.guid;
  if (typeof o.content === "string") out.content = o.content;
  return out;
}

const feedRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: FeedQuery; Reply: FeedResponse }>(
    "/feed",
    { schema: { querystring: FeedQuerySchema, response: { 200: FeedResponseSchema } } },
    async (req, reply) => {
      app.log.info({ query: req.query }, "GET /feed: incoming");

      const cfgUrl = app.config.DEFAULT_FEED_URL;
      const url = typeof req.query.url === "string" ? req.query.url : cfgUrl;
      if (!url) {
        throw app.httpErrors.badRequest("DEFAULT_FEED_URL is not set");
      }

      const force = req.query.force === "1";

      try {
        const data = await getOrParseFeed(app, url, force);

        let title: string | undefined;
        if (data && typeof (data as { title?: unknown }).title === "string") {
          title = (data as { title?: string }).title;
        }

        let rawItems: unknown[] = [];
        if (data && Array.isArray((data as { items?: unknown }).items)) {
          rawItems = (data as { items?: unknown[] }).items as unknown[];
        }

        const items = rawItems.map(normalizeItem);
        const body: FeedResponse = { url, items };
        if (title) body.title = title;

        app.log.info({ url, items: items.length }, "GET /feed: ok");
        return body;
      } catch (e: unknown) {
        const err = normalizeError(e);
        app.log.error({ url, errName: err.name, errMsg: err.message }, "GET /feed: failed");
        return reply.code(502).send({ url, items: [], title: "Failed to fetch feed" });
      }
    },
  );
};

export default feedRoutes;
