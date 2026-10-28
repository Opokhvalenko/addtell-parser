import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyInstance } from "fastify";
import errorHandling from "../src/plugins/error-handling.plugin.js";
import { closeTestApp, createTestApp } from "./setup.js";

/** A request that hangs is the bug this guards against; anything slower than this is a failure. */
const FAST_RESPONSE_MS = 1000;
/** Render appends the real client address as the last X-Forwarded-For entry. */
const CLIENT_IP = "203.0.113.7";
const TEST_AUTH_LIMIT = 3;

let app: FastifyInstance;

async function timed(url: string, method: "GET" | "POST" = "GET") {
  const startedAt = Date.now();
  const res = await Promise.race([
    app.inject({ method, url }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), FAST_RESPONSE_MS)),
  ]);
  return { res, ms: Date.now() - startedAt };
}

describe("request guard", () => {
  before(async () => {
    app = await createTestApp();
  });
  after(async () => {
    await closeTestApp(app);
  });

  test("unknown paths answer 404 at once instead of hanging", async () => {
    for (const url of ["/nope.js", "/api/nope", "/ads/missing.json"]) {
      const { res } = await timed(url);
      assert.ok(res, `${url} hung`);
      assert.equal(res.statusCode, 404, url);
    }
  });

  test("protected routes answer 401 without a session", async () => {
    for (const [method, url] of [
      ["GET", "/metrics"],
      ["POST", "/api/ads/lineitems"],
      ["POST", "/api/adserver/line-items"],
      ["GET", "/api/auth/me"],
    ] as const) {
      const { res } = await timed(url, method);
      assert.ok(res, `${url} hung`);
      assert.equal(res.statusCode, 401, url);
    }
  });

  test("public static files are served without a session", async () => {
    const res = await app.inject({ method: "GET", url: "/assets/tw-embed.css" });
    assert.equal(res.statusCode, 200);
  });

  test("a prefix of a public route does not make a lookalike path public", async () => {
    // Previously `startsWith("/feed")` also opened e.g. /feedback
    const { res } = await timed("/feedback", "POST");
    assert.ok(res);
    assert.notEqual(res.statusCode, 200);
  });

  test("login is limited per real client IP, a forged X-Forwarded-For does not reset it", async () => {
    // A separate app with a small limit (the shared one allows many test registrations)
    const previous = process.env.AUTH_RATE_LIMIT_MAX;
    process.env.AUTH_RATE_LIMIT_MAX = String(TEST_AUTH_LIMIT);
    const limited = await createTestApp();
    process.env.AUTH_RATE_LIMIT_MAX = previous;
    const attempts = TEST_AUTH_LIMIT + 1;
    let last = 0;
    for (let i = 0; i < attempts; i++) {
      const res = await limited.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { "x-forwarded-for": `10.0.0.${i}, ${CLIENT_IP}` },
        payload: { email: "nobody@example.com", password: "wrong-password-1" },
      });
      last = res.statusCode;
      if (i === attempts - 1) {
        assert.equal(res.json().statusCode, 429);
        assert.ok(res.headers["retry-after"]);
      }
    }
    await closeTestApp(limited);
    assert.equal(last, 429);
  });

  test("server errors do not leak internal messages", async () => {
    const probe = Fastify({ logger: false });
    await probe.register(sensible);
    await probe.register(errorHandling);
    probe.get("/boom", async () => {
      throw new Error("connect ECONNREFUSED clickhouse.internal:8123");
    });
    const res = await probe.inject({ method: "GET", url: "/boom" });
    await probe.close();
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.json(), { error: "Internal Server Error", statusCode: 500 });
  });

  test("/health reports only up/down, never error texts", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    const { checks } = res.json() as { checks: Record<string, Record<string, unknown>> };
    for (const check of Object.values(checks)) {
      assert.deepEqual(Object.keys(check), ["ok"]);
    }
  });

  test("anonymous ad requests get a signed uid cookie for frequency capping", async () => {
    const res = await app.inject({ method: "GET", url: "/api/bid?size=300x250" });
    assert.ok(res.cookies.some((c) => c.name === "uid" && c.httpOnly));
  });

  test("the uid cookie is not set on other responses (e.g. long-cached static files)", async () => {
    for (const url of ["/assets/tw-embed.css", "/health"]) {
      const res = await app.inject({ method: "GET", url });
      assert.ok(!res.cookies.some((c) => c.name === "uid"), url);
    }
  });
});
