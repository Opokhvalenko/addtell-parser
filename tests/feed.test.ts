import { strict as assert } from "node:assert";
import { after, before, beforeEach, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { closeTestApp, createTestApp } from "./setup.js";

// No network in these tests: a stored feed is served from the database. Fetching itself is
// covered by tests/safe-fetch.test.ts against a local server.
let app: FastifyInstance;

describe("Feed module", () => {
  before(async () => {
    app = await createTestApp();
  });
  after(async () => {
    await closeTestApp(app);
  });
  beforeEach(async () => {
    await app.prisma.feedItem.deleteMany();
    await app.prisma.feed.deleteMany();
  });

  test("GET /api/feed serves the stored default feed without fetching it again", async () => {
    const url = app.config.DEFAULT_FEED_URL;
    assert.ok(url);
    const feed = await app.prisma.feed.create({ data: { url, title: "Stored feed" } });
    await app.prisma.feedItem.create({
      data: { feedId: feed.id, link: "https://example.com/a", title: "First story" },
    });

    const response = await app.inject({ method: "GET", url: "/api/feed" });
    assert.equal(response.statusCode, 200);
    const body = response.json() as { title: string; url: string; items: Array<{ title: string }> };
    assert.equal(body.title, "Stored feed");
    assert.equal(body.url, url);
    assert.deepEqual(
      body.items.map((i) => i.title),
      ["First story"],
    );
  });

  test("GET /api/feed answers 502 when a configured source fails and nothing is cached", async () => {
    const sources = [
      "https://feed.invalid/rss", // never resolves (RFC 2606)
      "http://127.0.0.1:1/rss", // an address the fetch guard refuses
    ];
    const previous = process.env.FEEDS_SOURCES;
    process.env.FEEDS_SOURCES = sources.join(",");
    const withSources = await createTestApp();
    if (previous === undefined) delete process.env.FEEDS_SOURCES;
    else process.env.FEEDS_SOURCES = previous;
    try {
      for (const source of sources) {
        const response = await withSources.inject({
          method: "GET",
          url: `/api/feed?url=${encodeURIComponent(source)}`,
        });
        assert.equal(response.statusCode, 502, source);
        assert.deepEqual(response.json(), { error: "Bad Gateway", statusCode: 502 });
      }
    } finally {
      await closeTestApp(withSources);
    }
  });

  test("GET /api/feed rejects a malformed URL", async () => {
    const response = await app.inject({ method: "GET", url: "/api/feed?url=invalid-url" });
    assert.equal(response.statusCode, 400);
  });

  test("GET /api/article/:id answers 404 for an unknown article", async () => {
    const response = await app.inject({ method: "GET", url: "/api/article/non-existent-id" });
    assert.equal(response.statusCode, 404);
  });
});
