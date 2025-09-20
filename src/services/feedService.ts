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

type FeedItemCreate = {
  link: string;
  title?: string | null;
  content?: string | null;
  pubDate?: Date | null;
  guid?: string | null;
};

type RssItemMaybeEncoded = RssItem & { "content:encoded"?: string };

function toCreateInput(i: InputItem): FeedItemCreate {
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

  const raw = await withRetry(() => parseFeed(app, url), 3, 700);

  const items = (raw.items ?? []) as RssItemMaybeEncoded[];
  const parsedItems: InputItem[] = items
    .map((i) => {
      const out: InputItem = { link: i.link ?? "" };
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

  await app.prisma.feed.upsert({
    where: { url },
    update: {
      title: raw.title ?? null,
      items: { create: parsedItems.map(toCreateInput) },
    },
    create: {
      url,
      title: raw.title ?? null,
      items: { create: parsedItems.map(toCreateInput) },
    },
  });

  const fresh = await app.prisma.feed.findUnique({
    where: { url },
    include: { items: true },
  });

  return { title: fresh?.title ?? null, items: fresh?.items ?? [] };
}
