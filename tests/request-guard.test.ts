import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { closeTestApp, createTestApp } from "./setup.js";

/** A request that hangs is the bug this guards against; anything slower than this is a failure. */
const FAST_RESPONSE_MS = 1000;
/** Render appends the real client address as the last X-Forwarded-For entry. */
const CLIENT_IP = "203.0.113.7";
const OTHER_CLIENT_IP = "203.0.113.8";
/** Render's load balancer reaches the app from its private network. */
const RENDER_PROXY_IP = "10.204.1.17";
/** A routable address: documentation ranges count as internal, like the proxy network. */
const DIRECT_CLIENT_IP = "93.184.216.34";
const TEST_AUTH_LIMIT = 3;

let app: FastifyInstance;

/** Replaces one method for the duration of a test; returns the undo. */
function stub<T extends object, K extends keyof T>(target: T, key: K, impl: T[K]) {
  const original = target[key];
  target[key] = impl;
  return () => {
    target[key] = original;
  };
}

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

  test("clients behind the proxy get separate limits; a direct client cannot pick its IP", async () => {
    const previous = process.env.AUTH_RATE_LIMIT_MAX;
    process.env.AUTH_RATE_LIMIT_MAX = String(TEST_AUTH_LIMIT);
    const limited = await createTestApp();
    process.env.AUTH_RATE_LIMIT_MAX = previous;
    const login = (remoteAddress: string, forwardedFor: string) =>
      limited.inject({
        method: "POST",
        url: "/api/auth/login",
        remoteAddress,
        headers: { "x-forwarded-for": forwardedFor },
        payload: { email: "nobody@example.com", password: "wrong-password-1" },
      });
    try {
      // Through Render's proxy (a private address): the client is the last forwarded entry
      for (let i = 0; i <= TEST_AUTH_LIMIT; i++) await login(RENDER_PROXY_IP, CLIENT_IP);
      assert.equal(
        (await login(RENDER_PROXY_IP, CLIENT_IP)).statusCode,
        429,
        "client behind proxy",
      );
      assert.notEqual(
        (await login(RENDER_PROXY_IP, OTHER_CLIENT_IP)).statusCode,
        429,
        "another client behind proxy",
      );

      // A public peer is not a trusted proxy: its forwarded header is ignored
      for (let i = 0; i <= TEST_AUTH_LIMIT; i++) {
        await login(DIRECT_CLIENT_IP, `198.51.100.${i}`);
      }
      assert.equal(
        (await login(DIRECT_CLIENT_IP, "198.51.100.200")).statusCode,
        429,
        "direct client",
      );
    } finally {
      await closeTestApp(limited);
    }
  });

  test("server errors do not leak internal messages from any plugin's routes", async () => {
    // The real app, not a bare instance: a plugin registered before the error handler keeps
    // Fastify's default one, which sends `message` and `code` to the client
    const secret = "getaddrinfo ENOTFOUND db.internal.example";
    const fail = () => Promise.reject(new Error(secret));
    // Prisma delegates are proxies, which node:test's mock.method cannot wrap
    const restore = [
      stub(app.prisma.user, "findFirst", fail),
      stub(app.prisma.lineItem, "findMany", fail),
    ];
    try {
      for (const [method, url, payload] of [
        ["POST", "/api/auth/login", { email: "a@example.com", password: "password-123" }],
        ["GET", "/api/bid?size=300x250&type=banner", undefined],
      ] as const) {
        const res = await app.inject({ method, url, ...(payload ? { payload } : {}) });
        assert.equal(res.statusCode, 500, url);
        assert.deepEqual(res.json(), { error: "Internal Server Error", statusCode: 500 }, url);
      }
    } finally {
      for (const undo of restore) undo();
    }
  });

  test("something thrown that is not an error object is still a generic 500", async () => {
    const restore = stub(app.prisma.lineItem, "findMany", () => Promise.reject("raw string"));
    try {
      const res = await app.inject({ method: "GET", url: "/api/bid?size=300x250&type=banner" });
      assert.equal(res.statusCode, 500);
      assert.deepEqual(res.json(), { error: "Internal Server Error", statusCode: 500 });
    } finally {
      restore();
    }
  });

  test("/health is ok with the default MongoDB analytics store (ClickHouse is not a dependency)", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    assert.equal(res.statusCode, 200);
    assert.equal((res.json() as { status: string }).status, "ok");
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
