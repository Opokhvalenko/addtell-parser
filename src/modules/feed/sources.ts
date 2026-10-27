/** Feed URLs configured by the operator: `FEEDS_SOURCES` (JSON array or comma list) or the default. */
export function configuredFeedSources(config: {
  FEEDS_SOURCES?: string;
  DEFAULT_FEED_URL?: string;
}): string[] {
  const raw = (config.FEEDS_SOURCES ?? "").trim();
  if (raw.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {}
  }
  if (raw) {
    return raw
      .split(",")
      .map((source) => source.trim())
      .filter(Boolean);
  }
  return config.DEFAULT_FEED_URL ? [config.DEFAULT_FEED_URL] : [];
}

/**
 * The only feeds `/api/feed?url=` may fetch: the configured sources and the default feed.
 * Fetching and storing arbitrary user URLs would let anyone use the server as a proxy (SSRF)
 * and fill the database.
 */
export function allowedFeedUrls(config: { FEEDS_SOURCES?: string; DEFAULT_FEED_URL?: string }) {
  const urls = configuredFeedSources(config);
  if (config.DEFAULT_FEED_URL) urls.push(config.DEFAULT_FEED_URL);
  return new Set(urls);
}
