import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { FeedItemLite, FeedSnapshotItem, FeedsJson } from "./types.js";

type DbFeedItem = {
  link: string;
  title: string | null;
  guid: string | null;
  pubDate: Date | null;
};

type DbFeedWithItems = {
  title: string | null;
  items?: DbFeedItem[];
} | null;

export async function buildFeedsSnapshot(
  app: FastifyInstance,
  urls: string[],
  take: number,
): Promise<FeedSnapshotItem[]> {
  return Promise.all(
    urls.map(async (url) => {
      const feed = (await app.prisma.feed.findUnique({
        where: { url },
        include: { items: { orderBy: { pubDate: "desc" }, take } },
      })) as DbFeedWithItems;

      const items: FeedItemLite[] = (feed?.items ?? []).map((i) => ({
        link: i.link,
        title: i.title ?? "",
        guid: i.guid ?? null,
        pubDate: i.pubDate ?? null,
      }));

      return { url, title: feed?.title ?? null, count: items.length, items };
    }),
  );
}

export async function writeSnapshot(outPath: string, payload: FeedsJson) {
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(payload, null, 2));
}
