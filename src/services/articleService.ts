import { load } from "cheerio";
import type { FastifyInstance } from "fastify";

export type ParsedArticle = {
  url: string;
  canonicalUrl?: string;
  siteName?: string;
  title?: string;
  description?: string;
  author?: string;
  publishedAt?: string;
  content?: string;
};

function pick<T extends string | undefined | null>(...vals: T[]): string | undefined {
  return vals.find((v) => typeof v === "string" && v.trim().length > 0)?.trim();
}

function toPlainText(html: string): string {
  const $ = load(html);
  $("script, style, noscript, iframe, svg").remove();
  const text = $("body").text();
  return text.replace(/\s+/g, " ").trim();
}

export async function parseArticleByUrl(
  fastify: FastifyInstance,
  inputUrl: string,
): Promise<ParsedArticle> {
  const startedAt = Date.now();
  const reqHeaders = {
    "User-Agent": "AddTellParser/1.0 (+https://example.com)",
    Accept: "text/html,application/xhtml+xml",
  };

  fastify.log.info({ url: inputUrl }, "article: fetch start");

  const res = await fetch(inputUrl, { headers: reqHeaders });
  if (!res.ok) {
    const err = new Error(`Fetch failed: ${res.status}`);
    fastify.log.error({ url: inputUrl, status: res.status }, "article: fetch failed");
    throw err;
  }

  const html = await res.text();
  const $ = load(html);
  const baseUrl = new URL(inputUrl);

  const canonicalRaw = pick(
    $('meta[property="og:url"]').attr("content"),
    $('link[rel="canonical"]').attr("href"),
  );
  const canonicalUrl = canonicalRaw ? new URL(canonicalRaw, baseUrl).toString() : undefined;

  const siteName =
    pick($('meta[property="og:site_name"]').attr("content")) || baseUrl.hostname || undefined;

  const title = pick(
    $('meta[property="og:title"]').attr("content"),
    $("title").first().text(),
    $("h1").first().text(),
  );

  const description = pick(
    $('meta[name="description"]').attr("content"),
    $('meta[property="og:description"]').attr("content"),
  );

  const author = pick(
    $('[itemprop="author"]').first().text(),
    $(".author, .byline, .post-author").first().text(),
    $('meta[name="author"]').attr("content"),
  );

  const publishedAt = pick(
    $("time[datetime]").attr("datetime"),
    $('meta[property="article:published_time"]').attr("content"),
    $('meta[name="pubdate"]').attr("content"),
  );

  const candidates = [
    "article",
    ".post",
    ".article",
    ".entry-content",
    ".post-content",
    "main",
    '[role="main"]',
    "#content",
  ];

  let content = "";
  for (const sel of candidates) {
    const el = $(sel).first();
    if (!el.length) continue;
    const txt = toPlainText(el.html() ?? "");
    if (txt.length >= 200) {
      content = txt;
      break;
    }
  }

  if (!content) {
    let best = "";
    $("p").each((_, p) => {
      const t = $(p).text().replace(/\s+/g, " ").trim();
      if (t.length > best.length) best = t;
    });
    content = best || toPlainText(html);
  }

  const ms = Date.now() - startedAt;
  fastify.log.info({ url: inputUrl, ms, hasTitle: !!title, len: content.length }, "article: ok");

  return {
    url: baseUrl.toString(),
    ...(canonicalUrl ? { canonicalUrl } : {}),
    ...(siteName ? { siteName } : {}),
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(author ? { author } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    ...(content ? { content } : {}),
  };
}
