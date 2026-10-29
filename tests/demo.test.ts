import { strict as assert } from "node:assert";
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { closeTestApp, createTestApp } from "./setup.js";

const DEMO_EMAIL = "demo@example.com";
const DEMO_SESSIONS_KEPT = 100;
const SESSIONS_OVER_CAP = 5;
const TEST_EMAIL_LIMIT = 2;

/** Builds an app with the given variables set only while it starts. */
async function appWith(env: Record<string, string>): Promise<FastifyInstance> {
  const previous = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);
  try {
    return await createTestApp();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const demoLogin = (app: FastifyInstance) =>
  app.inject({ method: "POST", url: "/api/auth/demo", payload: {} });

const cookie = (res: Awaited<ReturnType<typeof demoLogin>>, name: string) =>
  res.cookies.find((c) => c.name === name)?.value ?? "";

describe("demo sign-in: POST /api/auth/demo", () => {
  let app: FastifyInstance;

  async function resetUsers(target: FastifyInstance) {
    await target.prisma.refreshToken.deleteMany();
    await target.prisma.user.deleteMany();
  }

  describe("without DEMO_ACCOUNT_EMAIL", () => {
    before(async () => {
      app = await createTestApp();
    });
    after(async () => {
      await closeTestApp(app);
    });

    test("there is no demo: 404 and no session", async () => {
      await resetUsers(app);
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: DEMO_EMAIL, password: "password-123" },
      });
      const res = await demoLogin(app);
      assert.equal(res.statusCode, 404);
      assert.equal(cookie(res, "token"), "");
    });
  });

  test("an empty DEMO_ACCOUNT_EMAIL starts the server with the demo off; a malformed one does not start", async () => {
    const empty = await appWith({ DEMO_ACCOUNT_EMAIL: "" });
    try {
      assert.equal((await demoLogin(empty)).statusCode, 404);
    } finally {
      await closeTestApp(empty);
    }
    await assert.rejects(appWith({ DEMO_ACCOUNT_EMAIL: "not-an-email" }), /DEMO_ACCOUNT_EMAIL/);
  });

  describe("with DEMO_ACCOUNT_EMAIL", () => {
    before(async () => {
      app = await appWith({
        DEMO_ACCOUNT_EMAIL: DEMO_EMAIL,
        AUTH_EMAIL_RATE_LIMIT_MAX: String(TEST_EMAIL_LIMIT),
      });
    });
    after(async () => {
      await closeTestApp(app);
    });
    beforeEach(async () => {
      await resetUsers(app);
    });
    afterEach(async () => {
      await resetUsers(app);
    });

    const createDemoAccount = () =>
      app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: DEMO_EMAIL, password: "private-demo-password" },
      });

    test("the account does not exist yet: 404", async () => {
      assert.equal((await demoLogin(app)).statusCode, 404);
    });

    test("signs into the demo account without a password; the session works", async () => {
      await createDemoAccount();
      const res = await demoLogin(app);
      assert.equal(res.statusCode, 200);
      assert.equal((res.json() as { email: string }).email, DEMO_EMAIL);
      assert.equal("token" in (res.json() as object), false, "no token in the body");

      const me = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { cookie: `token=${cookie(res, "token")}` },
      });
      assert.equal(me.statusCode, 200);
      assert.equal((me.json() as { email: string }).email, DEMO_EMAIL);
    });

    test("a form on another site cannot sign its visitors into the demo (login CSRF)", async () => {
      await createDemoAccount();
      // What an HTML form can send cross-site without a preflight: no body, text/plain, urlencoded
      const forged = [
        {},
        { headers: { "content-type": "text/plain" }, payload: "{}" },
        { headers: { "content-type": "application/x-www-form-urlencoded" }, payload: "a=1" },
      ];
      for (const request of forged) {
        const res = await app.inject({ method: "POST", url: "/api/auth/demo", ...request });
        assert.ok(
          [400, 415].includes(res.statusCode),
          `${JSON.stringify(request)} → ${res.statusCode}`,
        );
        assert.equal(cookie(res, "token"), "", "no session cookie");
      }
    });

    test("failed password logins that lock /login do not lock the demo button", async () => {
      await createDemoAccount();
      for (let i = 0; i <= TEST_EMAIL_LIMIT; i++) {
        await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { email: DEMO_EMAIL, password: "wrong-password-1" },
        });
      }
      const locked = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: DEMO_EMAIL, password: "wrong-password-1" },
      });
      assert.equal(locked.statusCode, 429);
      assert.equal((await demoLogin(app)).statusCode, 200);
    });

    test(`keeps at most ${DEMO_SESSIONS_KEPT} demo sessions; the newest still refreshes`, async () => {
      await createDemoAccount();
      let last = await demoLogin(app);
      for (let i = 1; i < DEMO_SESSIONS_KEPT + SESSIONS_OVER_CAP; i++) {
        last = await demoLogin(app);
      }
      assert.equal(await app.prisma.refreshToken.count(), DEMO_SESSIONS_KEPT);

      const refreshed = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        cookies: { refresh: cookie(last, "refresh") },
      });
      assert.equal(refreshed.statusCode, 200);
    });
  });
});
