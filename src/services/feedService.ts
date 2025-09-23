import type { FastifyInstance } from "fastify";
import { withRetry } from "../utils/retry.js";
import type { RssItem } from "./feedParser.js";
import { parseFeed } from "./feedParser.js";

type InputItem = {
  link: string;
  title?: string;
  content?: string;
  pubDate?: string | Date;
  guid?: string;
};

type FeedItemCreateCore = {
  link: string;
  title?: string | null;
  content?: string | null;
  pubDate?: Date | null;
  guid?: string | null;
};

type RssItemMaybeEncoded = RssItem & { "content:encoded"?: string };

function toCreateCore(i: InputItem): FeedItemCreateCore {
  return {
    link: i.link,
    title: i.title ?? null,
    content: i.content ?? null,
    pubDate: i.pubDate instanceof Date ? i.pubDate : i.pubDate ? new Date(i.pubDate) : null,
    guid: i.guid ?? null,
  };
}

/**
 * @param app Fastify instance
 * @param url URL RSS/Atom
 * @param force
 */
export async function getOrParseFeed(app: FastifyInstance, url: string, force = false) {
  const existing = await app.prisma.feed.findUnique({
    where: { url },
    include: { items: true },
  });

  if (existing && !force) {
    app.log.info({ url, items: existing.items.length }, "feed: return cached");
    return { title: existing.title, items: existing.items };
  }

  try {
    const raw = await withRetry(() => parseFeed(app, url), 3, 700);

    const items = (raw.items ?? []) as RssItemMaybeEncoded[];
    const parsedItems: InputItem[] = items
      .map((i) => {
        const out: InputItem = { link: i.link ?? "" };
        if (!out.link) return out;
        if (i.title != null) out.title = i.title;
        const encoded = i["content:encoded"];
        if (encoded != null) out.content = encoded;
        else if (i.content != null) out.content = i.content;
        if (i.pubDate != null) out.pubDate = i.pubDate;
        if (i.guid != null) out.guid = i.guid;
        return out;
      })
      .filter((i) => i.link);

    app.log.info({ url, title: raw.title, count: parsedItems.length }, "feed: parsed");

    const feed = await app.prisma.feed.upsert({
      where: { url },
      update: { title: raw.title ?? null },
      create: { url, title: raw.title ?? null },
    });

    const data = parsedItems.map((i) => ({
      ...toCreateCore(i),
      feedId: feed.id,
    }));

    await Promise.allSettled(
      data.map((d) =>
        app.prisma.feedItem.upsert({
          where: { feedId_link: { feedId: d.feedId as string, link: d.link } },
          update: {
            ...(d.title !== undefined ? { title: d.title } : {}),
            ...(d.content !== undefined ? { content: d.content } : {}),
            ...(d.pubDate !== undefined ? { pubDate: d.pubDate } : {}),
            ...(d.guid !== undefined ? { guid: d.guid } : {}),
          },
          create: d,
        }),
      ),
    );

    const fresh = await app.prisma.feed.findUnique({
      where: { url },
      include: { items: true },
    });

    return { title: fresh?.title ?? null, items: fresh?.items ?? [] };
  } catch (err) {
    if (existing) {
      app.log.warn(
        { url, cachedItems: existing.items.length, err: (err as Error).message },
        "feed: parse failed, returning cached",
      );
      return { title: existing.title, items: existing.items };
    }
    app.log.error({ url, err: (err as Error).message }, "feed: parse failed and no cache");
    throw err;
  }
}
