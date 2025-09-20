import type { FastifyInstance } from "fastify";
import { withRetry } from "../utils/retry.js";
import { parseFeed } from "./feedParser.js";

// Те, що повертає parseFeed
type ParsedItem = {
  link: string;
  title: string | undefined;
  content: string | undefined;
  pubDate: Date | undefined;
  guid: string | undefined;
};

// Структурний тип для nested create, сумісний з Prisma
type FeedItemCreate = {
  link: string;
  title?: string | null;
  content?: string | null;
  pubDate?: Date | null;
  guid?: string | null;
};

function toCreateInput(i: ParsedItem): FeedItemCreate {
  return {
    link: i.link,
    title: i.title ?? null,
    content: i.content ?? null,
    pubDate: i.pubDate ?? null,
    guid: i.guid ?? null,
  };
}

export async function getOrParseFeed(
  app: FastifyInstance,
  url: string,
  force = false,
) {
  const existing = await app.prisma.feed.findUnique({
    where: { url },
    include: { items: true },
  });
  if (existing && !force) {
    return { title: existing.title, items: existing.items };
  }

  const parsed = await withRetry(() => parseFeed(url), 3, 700);

  // upsert без жодних кастів типів
  await app.prisma.feed.upsert({
    where: { url },
    update: {
      title: parsed.title ?? null, // важливо: null, не undefined
      items: {
        create: parsed.items.map(toCreateInput),
      },
    },
    create: {
      url,
      title: parsed.title ?? null,
      items: {
        create: parsed.items.map(toCreateInput),
      },
    },
  });

  // робимо гарантовано типобезпечний рефетч з include: { items: true }
  const fresh = await app.prisma.feed.findUnique({
    where: { url },
    include: { items: true },
  });

  return { title: fresh?.title ?? null, items: fresh?.items ?? [] };
}