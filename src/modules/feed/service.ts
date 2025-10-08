export interface FeedItem {
  title: string;
  link: string;
  description?: string | undefined;
  pubDate?: string | undefined;
}

export interface ParsedFeed {
  title: string;
  items: FeedItem[];
}

export async function parseFeed(content: string): Promise<ParsedFeed> {
  const titleMatch = content.match(/<title>(.*?)<\/title>/);
  const title = titleMatch?.[1] || "Unknown Feed";

  const itemMatches = content.match(/<item>[\s\S]*?<\/item>/g) || [];
  const items: FeedItem[] = itemMatches.map((item) => {
    const titleMatch = item.match(/<title>(.*?)<\/title>/);
    const linkMatch = item.match(/<link>(.*?)<\/link>/);
    const descMatch = item.match(/<description>(.*?)<\/description>/);
    const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);

    return {
      title: titleMatch?.[1] || "",
      link: linkMatch?.[1] || "",
      description: descMatch?.[1],
      pubDate: dateMatch?.[1],
    };
  });

  return { title, items };
}
