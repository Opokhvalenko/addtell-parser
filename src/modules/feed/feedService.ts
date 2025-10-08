import type { FastifyInstance } from "fastify";
import { normalizeError } from "../../utils/errors.js";
import { getPrisma } from "../../utils/prisma.js";
import { withRetry } from "../../utils/retry.js";
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
  const out: FeedItemCreateCore = {
    link: i.link,
    title: i.title ?? null,
    content: i.content ?? null,
    pubDate: i.pubDate instanceof Date ? i.pubDate : i.pubDate ? new Date(i.pubDate) : null,
    guid: i.guid ?? null,
  };
  return out;
}

export async function getOrParseFeed(app: FastifyInstance, url: string, force = false) {
  const prisma = getPrisma(app);
  const existing = await prisma.feed.findUnique({
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
    const parsedItems: InputItem[] = [];
    for (const i of items) {
      const link = i.link ?? "";
      if (!link) continue;
      const m: InputItem = { link };
      if (i.title != null) m.title = i.title;
      const enc = i["content:encoded"];
      if (enc != null) m.content = enc;
      else if (i.content != null) m.content = i.content;
      if (i.pubDate != null) m.pubDate = i.pubDate;
      if (i.guid != null) m.guid = i.guid;
      parsedItems.push(m);
    }

    app.log.info({ url, title: raw.title, count: parsedItems.length }, "feed: parsed");

    const feed = await prisma.feed.upsert({
      where: { url },
      update: { title: raw.title ?? null },
      create: { url, title: raw.title ?? null },
    });

    const data = parsedItems.map((i) => ({ ...toCreateCore(i), feedId: feed.id }));

    let created = 0;
    let updated = 0;
    for (const d of data) {
      try {
        await prisma.feedItem.upsert({
          where: { feedId_link: { feedId: d.feedId as string, link: d.link } },
          update: {
            ...(d.title !== undefined ? { title: d.title } : {}),
            ...(d.content !== undefined ? { content: d.content } : {}),
            ...(d.pubDate !== undefined ? { pubDate: d.pubDate } : {}),
            ...(d.guid !== undefined ? { guid: d.guid } : {}),
          },
          create: d,
        });
        created += 1;
      } catch (error) {
        updated += 1;
        const errorMessage = error instanceof Error ? error.message : String(error);
        app.log.debug(
          { error: errorMessage, link: d.link },
          "feed: upsert item failed, counted as updated",
        );
      }
    }

    const fresh = await prisma.feed.findUnique({
      where: { url },
      include: { items: true },
    });
    app.log.info({ url, created, updated, items: fresh?.items.length ?? 0 }, "feed: stored");

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

export async function getOrParseFeedService(app: FastifyInstance, url: string, force: boolean) {
  try {
    return await getOrParseFeed(app, url, force);
  } catch (error: unknown) {
    const normalizedError = normalizeError(error);
    app.log.error({ url, error: normalizedError }, "Failed to get or parse feed");
    throw normalizedError;
  }
}
