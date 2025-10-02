import { type Cheerio, type CheerioAPI, load } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { isTag } from "domutils";
import type { FastifyInstance } from "fastify";

export type ParsedArticle = {
  url: string;
  canonicalUrl?: string;
  siteName?: string;
  title?: string;
  description?: string;
  author?: string;
  publishedAt?: string;
  html: string;
  content: string;
};

function firstNonEmpty(...vals: Array<string | undefined | null>): string | undefined {
  for (const v of vals) {
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length > 0) return t;
    }
  }
  return undefined;
}

function textFromSelection(sel: Cheerio<AnyNode>): string {
  sel.find("script, style, noscript, iframe, svg").remove();
  return sel.text().replace(/\s+/g, " ").trim();
}

function textFromDoc($: CheerioAPI): string {
  $("script, style, noscript, iframe, svg").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

function absolutizeUrl(base: URL, value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    if (/^(#|mailto:|tel:)/i.test(value)) return value;
    return new URL(value, base).toString();
  } catch {
    return undefined;
  }
}

const ALLOWED_TAGS = new Set([
  "article",
  "section",
  "header",
  "footer",
  "main",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "br",
  "hr",
  "ul",
  "ol",
  "li",
  "strong",
  "b",
  "em",
  "i",
  "code",
  "pre",
  "blockquote",
  "figure",
  "figcaption",
  "img",
  "a",
]);

const ALLOWED_ATTR: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  code: new Set(["class"]),
  pre: new Set(["class"]),
};

function sanitizeAndAbsolutize($: CheerioAPI, $container: Cheerio<AnyNode>, base: URL) {
  $container.find("*").each((_i: number, node: AnyNode) => {
    if (!isTag(node)) return;
    const el: Element = node;
    const name = el.name?.toLowerCase();
    if (!name) return;

    if (["script", "style", "noscript", "iframe", "svg"].includes(name)) {
      $(el).remove();
      return;
    }

    if (!ALLOWED_TAGS.has(name)) {
      $(el).replaceWith($(el).contents());
      return;
    }

    const allowed = ALLOWED_ATTR[name] ?? new Set<string>();
    const attrs: Record<string, string> = el.attribs ?? {};
    for (const attrName of Object.keys(attrs)) {
      const low = attrName.toLowerCase();

      if (low.startsWith("on")) {
        $(el).removeAttr(attrName);
        continue;
      }
      if (!allowed.has(low)) {
        $(el).removeAttr(attrName);
        continue;
      }

      if (name === "a" && low === "href") {
        const baseHref = $.root().find("base").attr("href") || "";
        const abs = absolutizeUrl(new URL(baseHref || "", base), attrs[attrName]);
        if (!abs || abs.toLowerCase().startsWith("javascript:")) {
          $(el).removeAttr(attrName);
        } else {
          $(el).attr("href", abs);
          $(el).attr("target", "_blank");
          $(el).attr("rel", "noopener noreferrer nofollow");
        }
      }

      if (name === "img" && low === "src") {
        const abs = absolutizeUrl(base, attrs[attrName]);
        if (!abs) $(el).remove();
        else $(el).attr("src", abs);
      }
    }
  });
}

function pickMainContainer($: CheerioAPI): Cheerio<AnyNode> | null {
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
  for (const sel of candidates) {
    const el = $(sel).first();
    if (el.length > 0) return el;
  }
  let best: Cheerio<AnyNode> | null = null;
  let bestLen = 0;
  $("article, div").each((_i, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t.length > bestLen) {
      best = $(el);
      bestLen = t.length;
    }
  });
  return best;
}

export async function parseArticleByUrl(
  app: FastifyInstance,
  inputUrl: string,
): Promise<ParsedArticle> {
  const startedAt = Date.now();
  const baseUrl = new URL(inputUrl);

  app.log.info({ url: inputUrl }, "article: fetch start");

  let res: Response;
  try {
    res = await fetch(inputUrl, {
      headers: {
        "User-Agent": "AddTellParser/1.0 (+https://example.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (e) {
    app.log.error({ url: inputUrl, err: e }, "article: network error");
    throw app.httpErrors.badGateway("Failed to fetch article");
  }
  if (!res.ok) {
    app.log.error({ url: inputUrl, status: res.status }, "article: fetch failed");
    throw app.httpErrors.badGateway(`Upstream responded ${res.status}`);
  }

  const htmlRaw = await res.text();
  const $ = load(htmlRaw);

  const canonicalRaw = firstNonEmpty(
    $('meta[property="og:url"]').attr("content"),
    $('link[rel="canonical"]').attr("href"),
  );
  const canonicalAbs = canonicalRaw ? absolutizeUrl(baseUrl, canonicalRaw) : undefined;

  const siteName =
    firstNonEmpty($('meta[property="og:site_name"]').attr("content")) ?? baseUrl.hostname;

  const title = firstNonEmpty(
    $('meta[property="og:title"]').attr("content"),
    $("title").first().text(),
    $("h1").first().text(),
  );

  const description = firstNonEmpty(
    $('meta[name="description"]').attr("content"),
    $('meta[property="og:description"]').attr("content"),
  );

  const author = firstNonEmpty(
    $('[itemprop="author"]').first().text(),
    $(".author, .byline, .post-author").first().text(),
    $('meta[name="author"]').attr("content"),
  );

  const publishedAt = firstNonEmpty(
    $("time[datetime]").attr("datetime"),
    $('meta[property="article:published_time"]').attr("content"),
    $('meta[name="pubdate"]').attr("content"),
  );

  const main = pickMainContainer($);
  let html = "";
  let content = "";

  if (main && main.length > 0) {
    const clone = load(`<div id="__root__">${main.html() ?? ""}</div>`);
    sanitizeAndAbsolutize(clone, clone("#__root__"), baseUrl);
    html = clone("#__root__").html() ?? "";
    content = textFromSelection(clone("#__root__"));
  }

  if (!html || content.length < 200) {
    let tmp = "";
    $("p").each((_i, p) => {
      const t = $(p).text().replace(/\s+/g, " ").trim();
      if (t) tmp += `<p>${t}</p>`;
    });
    if (tmp) {
      const clone = load(`<div id="__root__">${tmp}</div>`);
      sanitizeAndAbsolutize(clone, clone("#__root__"), baseUrl);
      html = clone("#__root__").html() ?? html;
      content = content || textFromSelection(clone("#__root__"));
    }
  }

  if (!content) content = textFromDoc($);

  const ms = Date.now() - startedAt;
  app.log.info(
    { url: inputUrl, ms, hasTitle: Boolean(title), htmlLen: html.length },
    "article: ok",
  );

  const out: ParsedArticle = { url: baseUrl.toString(), html, content };
  if (canonicalAbs) out.canonicalUrl = canonicalAbs;
  if (siteName) out.siteName = siteName;
  if (title) out.title = title;
  if (description) out.description = description;
  if (author) out.author = author;
  if (publishedAt) out.publishedAt = publishedAt;

  return out;
}
