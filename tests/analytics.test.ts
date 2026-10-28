import { strict as assert } from "node:assert";
import { after, before, beforeEach, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { MAX_EVENTS_PER_REQUEST, MAX_STATS_RANGE_DAYS } from "../src/modules/analytics/schemas.js";
import { createReporter, toRow } from "../src/modules/analytics/service.js";
import type { AnalyticsStore } from "../src/modules/analytics/store.js";
import { ensureTtlIndex } from "../src/utils/mongo-ttl.js";
import { closeTestApp, createTestApp } from "./setup.js";

const RETENTION_SECONDS = 30 * 86_400;
const FREQUENCY_WINDOW_SECONDS = 24 * 3600;
const EVENTS_PER_MINUTE = 120;
const OVERSIZED_BODY_BYTES = 300 * 1024;
const WRITE_DELAY_MS = 5;

let app: FastifyInstance;

const events = (payload: unknown, ip = "198.51.100.1") =>
  app.inject({
    method: "POST",
    url: "/api/analytics/events",
    payload: payload as object,
    remoteAddress: ip,
  });

const won = (cpm: number) => ({
  event: "bidWon",
  adapter: "adtelligent",
  bidder: "adtelligent",
  cpm,
});

async function signIn(email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, password: "password-123" },
  });
  return `token=${res.cookies.find((c) => c.name === "token")?.value ?? ""}`;
}

const today = () => new Date().toISOString().slice(0, 10);

describe("analytics", () => {
  before(async () => {
    app = await createTestApp();
  });
  after(async () => {
    await closeTestApp(app);
  });
  beforeEach(async () => {
    await app.analyticsReporter.flush();
    await app.prisma.analyticsEvent.deleteMany();
    await app.prisma.refreshToken.deleteMany();
    await app.prisma.user.deleteMany();
  });

  describe("ingest", () => {
    test("stores a batch with the server's time and without unknown fields", async () => {
      const clientTs = "1999-01-01T00:00:00Z";
      const res = await events([
        { ...won(2.5), ts: clientTs, password: "x" },
        { event: "auctionInit" },
      ]);
      assert.equal(res.statusCode, 204);
      await app.analyticsReporter.flush();

      const rows = await app.prisma.analyticsEvent.findMany({ orderBy: { event: "asc" } });
      assert.deepEqual(
        rows.map((r) => [r.event, r.cpm]),
        [
          ["auctionInit", 0],
          ["bidWon", 2.5],
        ],
      );
      assert.ok(
        rows.every((r) => r.ts.getUTCFullYear() > 2000),
        "client ts is ignored",
      );
      assert.ok(rows.every((r) => !("password" in r)));
    });

    test("the frontend's nulls (no referrer, no storage) are accepted", async () => {
      const res = await events([{ event: "pageLoad", ref: null, uid: null, cur: "USD" }]);
      assert.equal(res.statusCode, 204);
    });

    const rejected: Array<[string, unknown]> = [
      ["an empty batch", []],
      ["a single object instead of a batch", { event: "bidWon" }],
      [
        "more events than allowed",
        Array.from({ length: MAX_EVENTS_PER_REQUEST + 1 }, () => ({ event: "x" })),
      ],
      ["an event name that is not a name", [{ event: "<script>alert(1)</script>" }]],
      ["a CPM far outside any real bid", [won(1e9)]],
      ["a negative CPM", [won(-1)]],
      [
        "an over-long page URL",
        [{ event: "pageLoad", page: `https://x.test/${"a".repeat(5000)}` }],
      ],
      ["a currency that is not a code", [{ event: "bidWon", cur: "dollars" }]],
    ];
    for (const [name, payload] of rejected) {
      test(`rejects ${name} with 400 and stores nothing`, async () => {
        const res = await events(payload);
        assert.equal(res.statusCode, 400);
        await app.analyticsReporter.flush();
        assert.equal(await app.prisma.analyticsEvent.count(), 0);
      });
    }

    test("rejects an oversized body before parsing it", async () => {
      const res = await events([{ event: "pageLoad", page: "a".repeat(OVERSIZED_BODY_BYTES) }]);
      assert.equal(res.statusCode, 413);
    });

    test("is rate limited per client", async () => {
      let last = 0;
      for (let i = 0; i <= EVENTS_PER_MINUTE; i++) {
        last = (await events([{ event: "pageLoad" }], "198.51.100.99")).statusCode;
      }
      assert.equal(last, 429);
      assert.equal((await events([{ event: "pageLoad" }], "198.51.100.100")).statusCode, 204);
    });

    for (const [collection, field, seconds] of [
      ["AnalyticsEvent", "ts", RETENTION_SECONDS],
      // Impressions are written by every anonymous /api/bid; only the frequency window is read
      ["Impression", "at", FREQUENCY_WINDOW_SECONDS],
    ] as const) {
      test(`${collection} documents expire: a TTL index on ${field}`, async () => {
        // Indexes outlive test runs: drop it, then let a fresh app create it again at startup
        await app.prisma
          .$runCommandRaw({ dropIndexes: collection, index: `${field}_ttl` })
          .catch(() => undefined);
        const fresh = await createTestApp();
        try {
          const res = (await fresh.prisma.$runCommandRaw({ listIndexes: collection })) as {
            cursor: {
              firstBatch: Array<{ key: Record<string, number>; expireAfterSeconds?: number }>;
            };
          };
          const ttl = res.cursor.firstBatch.find((i) => i.key[field] === 1 && i.expireAfterSeconds);
          assert.equal(ttl?.expireAfterSeconds, seconds);
        } finally {
          await closeTestApp(fresh);
        }
      });
    }
  });

  describe("reporter", () => {
    const row = toRow({ event: "pageLoad" });

    test("flush resolves only after every buffered event is written (shutdown relies on it)", async () => {
      const written: string[] = [];
      let release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const store: AnalyticsStore = {
        name: "mongo",
        insert: async (rows) => {
          await gate;
          // A real write takes a while: resolve on a later timer turn, not a microtask
          await new Promise((resolve) => setTimeout(resolve, WRITE_DELAY_MS));
          written.push(...rows.map((r) => r.event));
        },
        stats: async () => [],
      };
      const reporter = createReporter(app, store, { batchSize: 1000, flushMs: 60_000 });
      reporter.enqueue([toRow({ event: "first" })]);
      const first = reporter.flush();
      reporter.enqueue([toRow({ event: "second" })]);
      const resumesFirst = reporter.flush();
      const resumesLast = reporter.flush();
      release();
      // The last caller alone: it must not return while the other caller's write is pending
      await resumesLast;
      assert.deepEqual(written, ["first", "second"]);
      await Promise.all([first, resumesFirst]);
    });

    test("a failed write is dropped, not put back into memory", async () => {
      let calls = 0;
      const failing: AnalyticsStore = {
        name: "mongo",
        insert: async () => {
          calls++;
          throw new Error("store is down");
        },
        stats: async () => [],
      };
      const reporter = createReporter(app, failing, { batchSize: 1000, flushMs: 60_000 });
      reporter.enqueue([row, row]);
      await reporter.flush();
      assert.equal(reporter.buffered(), 0);
      await reporter.flush();
      assert.equal(calls, 1, "nothing is retried");
    });

    test("the buffer has an upper bound", async () => {
      const inserted: number[] = [];
      const store: AnalyticsStore = {
        name: "mongo",
        insert: async (rows) => {
          inserted.push(rows.length);
        },
        stats: async () => [],
      };
      const reporter = createReporter(app, store, {
        batchSize: 1000,
        flushMs: 60_000,
        maxBuffered: 3,
      });
      reporter.enqueue([row, row]);
      reporter.enqueue([row, row, row]);
      assert.equal(reporter.buffered(), 3);
      await reporter.flush();
      assert.deepEqual(inserted, [3]);
    });
  });

  describe("ensureTtlIndex", () => {
    const COLLECTION = "TtlProbe";
    const ttlOf = async () => {
      const res = (await app.prisma.$runCommandRaw({ listIndexes: COLLECTION })) as {
        cursor: { firstBatch: Array<{ name: string; expireAfterSeconds?: number }> };
      };
      return res.cursor.firstBatch.find((i) => i.name === "at_ttl")?.expireAfterSeconds;
    };

    test("creates the index on a collection that does not exist yet, then follows a new retention", async () => {
      await app.prisma.$runCommandRaw({ drop: COLLECTION }).catch(() => undefined);
      try {
        await ensureTtlIndex(app, COLLECTION, "at", 100);
        assert.equal(await ttlOf(), 100);
        await ensureTtlIndex(app, COLLECTION, "at", 100);
        await ensureTtlIndex(app, COLLECTION, "at", 200);
        assert.equal(await ttlOf(), 200);
      } finally {
        await app.prisma.$runCommandRaw({ drop: COLLECTION }).catch(() => undefined);
      }
    });
  });

  describe("stats", () => {
    const stats = (query: string, cookie?: string) =>
      app.inject({
        method: "GET",
        url: `/api/analytics/stats?${query}`,
        ...(cookie ? { headers: { cookie } } : {}),
      });

    test("requires a session", async () => {
      const res = await stats(`from=${today()}&to=${today()}`);
      assert.equal(res.statusCode, 401);
    });

    test("the public /api/stats alias is gone", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/stats?from=${today()}&to=${today()}`,
      });
      assert.equal(res.statusCode, 404);
    });

    test("aggregates by day and event: count, wins and the average winning CPM", async () => {
      const cookie = await signIn("stats@example.com");
      await events([won(2), won(4), { event: "bidRequested", cpm: 100 }]);
      await app.analyticsReporter.flush();

      const res = await stats(
        `from=${today()}&to=${today()}&groupBy=day,event&metrics=count,wins,cpmAvg`,
        cookie,
      );
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), [
        { day: today(), event: "bidRequested", count: 1, wins: 0, cpmAvg: null },
        { day: today(), event: "bidWon", count: 2, wins: 2, cpmAvg: 3 },
      ]);
    });

    const invalid: Array<[string, string]> = [
      [
        "a day that does not exist (V8 would roll it over to 1 May)",
        "from=2026-04-31&to=2026-05-10",
      ],
      ["a month that does not exist", "from=2026-13-01&to=2026-05-10"],
      ["from after to", "from=2026-03-02&to=2026-03-01"],
      [`a range over ${MAX_STATS_RANGE_DAYS} days`, "from=2026-01-01&to=2026-12-31"],
      ["a date in another format", "from=01.03.2026&to=2026-03-01"],
    ];
    for (const [name, query] of invalid) {
      test(`rejects ${name} with 400`, async () => {
        const cookie = await signIn(
          `invalid-${invalid.findIndex(([n]) => n === name)}@example.com`,
        );
        const res = await stats(query, cookie);
        assert.equal(res.statusCode, 400);
      });
    }

    test("a store failure is a generic 500 without internal details", async () => {
      const cookie = await signIn("fail@example.com");
      const original = app.prisma.analyticsEvent.aggregateRaw;
      app.prisma.analyticsEvent.aggregateRaw = () =>
        Promise.reject(new Error("getaddrinfo ENOTFOUND analytics.internal"));
      try {
        const res = await stats(`from=${today()}&to=${today()}`, cookie);
        assert.equal(res.statusCode, 500);
        assert.deepEqual(res.json(), { error: "Internal Server Error", statusCode: 500 });
      } finally {
        app.prisma.analyticsEvent.aggregateRaw = original;
      }
    });
  });
});
