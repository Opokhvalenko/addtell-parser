import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { closeTestApp, createTestApp } from "./setup.js";

let app: FastifyInstance;

function directives(csp: unknown): Map<string, string> {
  return new Map(
    String(csp ?? "")
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name = "", ...values] = d.split(/\s+/);
        return [name, values.join(" ")] as const;
      }),
  );
}

async function signedInCookie(target: FastifyInstance, email: string): Promise<string> {
  const res = await target.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, password: "password-123" },
  });
  assert.equal(res.statusCode, 201, `register ${email}`);
  return `token=${res.cookies.find((c) => c.name === "token")?.value ?? ""}`;
}

describe("security headers", () => {
  before(async () => {
    app = await createTestApp();
    await app.prisma.refreshToken.deleteMany();
    await app.prisma.user.deleteMany();
  });
  after(async () => {
    await closeTestApp(app);
  });

  test("JSON answers, errors and redirects allow nothing and cannot be framed", async () => {
    // 200, 401, 404, and the 302 to the login page for an anonymous visitor of the form
    for (const url of [
      "/health",
      "/api/adserver/line-items",
      "/api/no-such-route",
      "/create-lineitem",
    ]) {
      const res = await app.inject({ method: "GET", url });
      assert.notEqual(res.headers["content-type"]?.toString().startsWith("text/html"), true, url);
      const csp = directives(res.headers["content-security-policy"]);
      assert.equal(csp.get("default-src"), "'none'", url);
      assert.equal(csp.get("frame-ancestors"), "'none'", url);
      assert.equal(res.headers["x-frame-options"], "DENY", url);
    }
  });

  test("the line-item page gets a page policy: same-origin framing, no eval, no plain http", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/create-lineitem",
      headers: { cookie: await signedInCookie(app, "page@example.com") },
    });
    assert.equal(res.statusCode, 200);
    const csp = directives(res.headers["content-security-policy"]);
    assert.equal(csp.get("frame-ancestors"), "'self'");
    assert.equal(csp.get("object-src"), "'none'");
    assert.equal(res.headers["x-frame-options"], "SAMEORIGIN");
    for (const [name, value] of csp) {
      assert.doesNotMatch(value, /'unsafe-eval'|(^|\s)http:/, name);
    }
  });

  test("API docs run without eval", async () => {
    const res = await app.inject({ method: "GET", url: "/docs/" });
    assert.equal(res.statusCode, 200);
    const csp = directives(res.headers["content-security-policy"]);
    assert.doesNotMatch(csp.get("script-src") ?? "", /'unsafe-eval'/);
    assert.equal(csp.get("frame-ancestors"), "'self'");
  });

  test("FRAME_ANCESTORS replaces the default for pages, never for JSON", async () => {
    const previous = process.env.FRAME_ANCESTORS;
    process.env.FRAME_ANCESTORS = "https://partner.example";
    const custom = await createTestApp();
    if (previous === undefined) delete process.env.FRAME_ANCESTORS;
    else process.env.FRAME_ANCESTORS = previous;
    try {
      const page = await custom.inject({
        method: "GET",
        url: "/create-lineitem",
        headers: { cookie: await signedInCookie(custom, "partner@example.com") },
      });
      const pageCsp = directives(page.headers["content-security-policy"]);
      assert.equal(pageCsp.get("frame-ancestors"), "https://partner.example");
      assert.equal(page.headers["x-frame-options"], undefined);

      const json = await custom.inject({ method: "GET", url: "/health" });
      assert.equal(
        directives(json.headers["content-security-policy"]).get("frame-ancestors"),
        "'none'",
      );
    } finally {
      await closeTestApp(custom);
    }
  });
});
