import type { FastifyInstance } from "fastify";
import Parser from "rss-parser";
import { normalizeError } from "../../utils/errors.js";
import { safeFetch, UpstreamError } from "../../utils/safe-fetch.js";

export type RssItem = {
  link: string;
  title?: string;
  content?: string;
  pubDate?: string;
  guid?: string;
};

// Only parses strings: network access goes through safeFetch
const parser = new Parser();

const FEED_ACCEPT = "application/rss+xml, application/xml;q=0.9, */*;q=0.8";

/** Fetches through the SSRF guard (no direct `parseURL`), then parses the XML. */
export async function parseFeed(app: FastifyInstance, url: string) {
  const startedAt = Date.now();
  app.log.info({ url }, "parseFeed: start");

  try {
    const res = await safeFetch(url, { accept: FEED_ACCEPT });
    if (res.status < 200 || res.status >= 300) {
      throw new UpstreamError(`Upstream responded ${res.status}`);
    }
    const feed = await parser.parseString(res.body);
    const count = Array.isArray(feed.items) ? feed.items.length : 0;
    app.log.info({ url, items: count, ms: Date.now() - startedAt }, "parseFeed: done");
    return feed;
  } catch (err: unknown) {
    const e = normalizeError(err);
    app.log.warn({ url, errName: e.name, errMsg: e.message }, "parseFeed: failed");
    // Network failure, bad status, XML that is not a feed, even a redirect to a refused address:
    // feeds come from the configured sources, so each of these is a problem of the source site
    throw err instanceof UpstreamError ? err : new UpstreamError(e.message);
  }
}
