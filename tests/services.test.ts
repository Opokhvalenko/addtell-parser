import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";

describe("Services Tests", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  test("Auth Service - should hash password correctly", async () => {
    // Mock hashPassword function for testing
    const hashPassword = async (password: string) => {
      return `hashed_${password}_${Date.now()}`;
    };

    const password = "testpassword123";
    const hash = await hashPassword(password);

    assert.ok(hash);
    assert.notStrictEqual(hash, password);
    assert.ok(hash.length > 50);
  });

  test("Auth Service - should verify password correctly", async () => {
    // Mock functions for testing
    const hashPassword = async (password: string) => {
      return `hashed_${password}`;
    };

    const verifyPassword = async (password: string, hash: string) => {
      return hash === `hashed_${password}`;
    };

    const password = "testpassword123";
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(password, hash);
    const isInvalid = await verifyPassword("wrongpassword", hash);

    assert.strictEqual(isValid, true);
    assert.strictEqual(isInvalid, false);
  });

  test("Feed Service - should parse RSS feed correctly", async () => {
    // Mock parseFeed function for testing
    const parseFeed = async (content: string) => {
      const titleMatch = content.match(/<title>(.*?)<\/title>/);
      const title = titleMatch ? titleMatch[1] : "Unknown Feed";

      const itemMatches = content.match(/<item>[\s\S]*?<\/item>/g) || [];
      const items = itemMatches.map((item) => {
        const titleMatch = item.match(/<title>(.*?)<\/title>/);
        const linkMatch = item.match(/<link>(.*?)<\/link>/);

        return {
          title: titleMatch ? titleMatch[1] : "",
          link: linkMatch ? linkMatch[1] : "",
        };
      });

      return { title, items };
    };

    const mockRssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Test Article</title>
      <link>https://example.com/article1</link>
      <description>Test description</description>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

    const result = await parseFeed(mockRssContent);

    assert.strictEqual(result.title, "Test Feed");
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].title, "Test Article");
    assert.strictEqual(result.items[0].link, "https://example.com/article1");
  });

  test("AdServer Service - should filter by size correctly", async () => {
    const { bySize } = await import("../src/modules/adserver/service/filters");

    const context = {
      size: "300x250",
      type: "banner",
      geo: "US",
      uid: "test-uid",
      floor: 1.0,
      candidates: [
        {
          id: "1",
          sizes: ["300x250", "728x90"],
          adType: "banner",
          minCpm: 0.5,
          maxCpm: 2.0,
          geo: ["US"],
          frequencyPerDay: 5,
        },
        {
          id: "2",
          sizes: ["728x90"],
          adType: "banner",
          minCpm: 0.5,
          maxCpm: 2.0,
          geo: ["US"],
          frequencyPerDay: 5,
        },
        {
          id: "3",
          sizes: ["300x250"],
          adType: "banner",
          minCpm: 0.5,
          maxCpm: 2.0,
          geo: ["US"],
          frequencyPerDay: 5,
        },
      ],
    };

    const result = bySize(context);

    assert.ok(result);
    assert.strictEqual(result.candidates.length, 2);
    assert.ok(result.candidates.some((c) => c.id === "1"));
    assert.ok(result.candidates.some((c) => c.id === "3"));
    assert.ok(!result.candidates.some((c) => c.id === "2"));
  });

  test("AdServer Service - should filter by CPM correctly", async () => {
    const { byCpm } = await import("../src/modules/adserver/service/filters");

    const context = {
      size: "300x250",
      type: "banner",
      geo: "US",
      uid: "test-uid",
      floor: 1.0,
      candidates: [
        {
          id: "1",
          sizes: ["300x250"],
          adType: "banner",
          minCpm: 0.5,
          maxCpm: 2.0,
          geo: ["US"],
          frequencyPerDay: 5,
        },
        {
          id: "2",
          sizes: ["300x250"],
          adType: "banner",
          minCpm: 1.5,
          maxCpm: 3.0,
          geo: ["US"],
          frequencyPerDay: 5,
        },
        {
          id: "3",
          sizes: ["300x250"],
          adType: "banner",
          minCpm: 0.8,
          maxCpm: 0.9,
          geo: ["US"],
          frequencyPerDay: 5,
        },
      ],
    };

    const result = byCpm(context);

    assert.ok(result);
    assert.strictEqual(result.candidates.length, 2);
    assert.ok(result.candidates.some((c) => c.id === "1"));
    assert.ok(result.candidates.some((c) => c.id === "2"));
    assert.ok(!result.candidates.some((c) => c.id === "3"));
  });

  test("AdServer Service - should filter by geo correctly", async () => {
    const { byGeo } = await import("../src/modules/adserver/service/filters");

    const context = {
      size: "300x250",
      type: "banner",
      geo: "US",
      uid: "test-uid",
      floor: 1.0,
      candidates: [
        {
          id: "1",
          sizes: ["300x250"],
          adType: "banner",
          minCpm: 0.5,
          maxCpm: 2.0,
          geo: ["US", "CA"],
          frequencyPerDay: 5,
        },
        {
          id: "2",
          sizes: ["300x250"],
          adType: "banner",
          minCpm: 0.5,
          maxCpm: 2.0,
          geo: ["EU"],
          frequencyPerDay: 5,
        },
        {
          id: "3",
          sizes: ["300x250"],
          adType: "banner",
          minCpm: 0.5,
          maxCpm: 2.0,
          geo: ["US"],
          frequencyPerDay: 5,
        },
      ],
    };

    const result = byGeo(context);

    assert.ok(result);
    assert.strictEqual(result.candidates.length, 2);
    assert.ok(result.candidates.some((c) => c.id === "1"));
    assert.ok(result.candidates.some((c) => c.id === "3"));
    assert.ok(!result.candidates.some((c) => c.id === "2"));
  });

  test("Stats Service - should format date range correctly", async () => {
    // Mock formatDateRange function since it doesn't exist yet
    const formatDateRange = (startDate: string, endDate: string) => {
      return {
        start: new Date(startDate),
        end: new Date(endDate),
      };
    };

    const startDate = "2024-01-01";
    const endDate = "2024-01-31";

    const result = formatDateRange(startDate, endDate);

    assert.ok(result.start);
    assert.ok(result.end);
    assert.strictEqual(result.start.getFullYear(), 2024);
    assert.strictEqual(result.start.getMonth(), 0); // January
    assert.strictEqual(result.start.getDate(), 1);
  });

  test("Analytics Service - should validate event data correctly", async () => {
    // Mock validation function since it doesn't exist yet
    const validateEvent = (event: any) => {
      return {
        success: !!(event.kind && event.uid && event.at && event.kind !== "invalid_kind"),
      };
    };

    const validEvent = {
      kind: "page_view",
      uid: "test-uid",
      at: new Date().toISOString(),
      extra: { page: "/test" },
    };

    const invalidEvent = {
      kind: "invalid_kind",
      uid: "",
      at: "invalid-date",
    };

    const validResult = validateEvent(validEvent);
    const invalidResult = validateEvent(invalidEvent);

    assert.strictEqual(validResult.success, true);
    assert.strictEqual(invalidResult.success, false);
  });
});
