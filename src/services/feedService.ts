//src/services/feedService.ts
import type { FastifyInstance } from "fastify";
import { withRetry } from "../utils/retry.js";
import { parseFeed } from "./feedParser.js";

export async function getOrParseFeed(app: FastifyInstance, url: string, force = false) {
  const existing = await app.prisma.feed.findUnique({ where: { url }, include: { items: true } });
  if (existing && !force) return { title: existing.title, items: existing.items };

  const parsed = await withRetry(() => parseFeed(url), 3, 700);

  const upserted = await app.prisma.feed.upsert({
    where: { url },
    update: {
      title: parsed.title ?? undefined,
      items: {
        createMany: {
          skipDuplicates: true,
          data: parsed.items.map((i) => ({
            link: i.link,
            title: i.title,
            content: i.content,
            pubDate: i.pubDate,
            guid: i.guid,
          })),
        },
      },
    },
    create: {
      url,
      title: parsed.title ?? undefined,
      items: {
        create: parsed.items.map((i) => ({
          link: i.link,
          title: i.title,
          content: i.content,
          pubDate: i.pubDate,
          guid: i.guid,
        })),
      },
    },
    include: { items: true },
  });
  return { title: upserted.title, items: upserted.items };
}
