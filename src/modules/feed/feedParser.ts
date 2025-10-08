import type { FastifyInstance } from "fastify";
import Parser from "rss-parser";
import { normalizeError } from "../../utils/errors.js";

export type RssItem = {
  link: string;
  title?: string;
  content?: string;
  pubDate?: string;
  guid?: string;
};

const parser = new Parser({
  timeout: 15_000,
  requestOptions: {
    headers: {
      "User-Agent": "addtell-parser/1.0 (+https://example.com)",
      Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
    },
  },
});

export async function parseFeed(app: FastifyInstance, url: string) {
  const startedAt = Date.now();
  app.log.info({ url }, "parseFeed: start");

  try {
    const feed = await parser.parseURL(url);
    const ms = Date.now() - startedAt;
    const count = Array.isArray(feed.items) ? feed.items.length : 0;
    app.log.info({ url, items: count, ms, mode: "parseURL" }, "parseFeed: done");
    return feed;
  } catch (err: unknown) {
    const e = normalizeError(err);
    app.log.warn(
      { url, errName: e.name, errMsg: e.message },
      "parseFeed: parseURL failed, trying fetch+parseString",
    );
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "addtell-parser/1.0 (+https://example.com)",
        Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
      },
    });

    const status = res.status;
    const ok = res.ok;
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();

    app.log.info(
      { url, status, ok, contentType: ct, bytes: text.length },
      "parseFeed: fetched, now parseString",
    );

    const feed = await parser.parseString(text);
    const ms = Date.now() - startedAt;
    const count = Array.isArray(feed.items) ? feed.items.length : 0;
    app.log.info({ url, items: count, ms, mode: "parseString" }, "parseFeed: done");
    return feed;
  } catch (err: unknown) {
    const e = normalizeError(err);
    app.log.error(
      { url, errName: e.name, errMsg: e.message },
      "parseFeed: failed on fetch+parseString",
    );
    throw err;
  }
}
