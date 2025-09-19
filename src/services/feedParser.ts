import Parser from "rss-parser";

type RssItem = Parser.Item & { "content:encoded"?: string };

const parser = new Parser<unknown, RssItem>({ timeout: 15000 });

export async function parseFeed(url: string) {
  const feed = await parser.parseURL(url);

  const items = (feed.items ?? [])
    .map((i) => {
      const richContent = i["content:encoded"];
      return {
        link: i.link ?? "",
        title: i.title ?? undefined,
        content: typeof richContent === "string" ? richContent : (i.content ?? undefined),
        pubDate: i.pubDate ? new Date(i.pubDate) : undefined,
        guid: i.guid ?? undefined,
      };
    })
    .filter((i) => i.link);

  return { title: feed.title ?? null, items };
}
