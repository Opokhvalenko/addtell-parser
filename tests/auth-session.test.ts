import { strict as assert } from "node:assert";
import { after, before, beforeEach, describe, test } from "node:test";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { REFRESH_COOKIE } from "../src/modules/auth/session.js";
import { assertLocalTestDatabase, closeTestApp, createTestApp } from "./setup.js";

const EMAIL = "Owner@Example.com";
const PASSWORD = "correct-horse-1";
const GRACE_EXPIRED_MS = 60_000;
const PARALLEL_REFRESHES = 5;

let app: FastifyInstance;

type Jar = Record<string, string>;

function cookiesFrom(res: LightMyRequestResponse): Jar {
  return Object.fromEntries(res.cookies.map((c) => [c.name, c.value]));
}

function cookieHeader(jar: Jar): string {
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function register(email = EMAIL): Promise<{ res: LightMyRequestResponse; jar: Jar }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, password: PASSWORD },
  });
  return { res, jar: cookiesFrom(res) };
}

function refresh(jar: Jar) {
  return app.inject({
    method: "POST",
    url: "/api/auth/refresh",
    headers: { cookie: cookieHeader({ [REFRESH_COOKIE]: jar[REFRESH_COOKIE] ?? "" }) },
  });
}

function me(jar: Jar) {
  return app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: cookieHeader(jar) } });
}

describe("auth session", () => {
  before(async () => {
    app = await createTestApp();
  });
  after(async () => {
    await closeTestApp(app);
  });
  beforeEach(async () => {
    await app.prisma.refreshToken.deleteMany();
    await app.prisma.user.deleteMany();
  });

  test("register sets httpOnly Lax cookies and never returns a token in the body", async () => {
    const { res } = await register();
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.deepEqual(Object.keys(body).sort(), ["email", "id"]);
    assert.equal(body.email, EMAIL.toLowerCase());

    const access = res.cookies.find((c) => c.name === "token");
    const refreshCookie = res.cookies.find((c) => c.name === REFRESH_COOKIE);
    assert.ok(access?.httpOnly && access.sameSite === "Lax" && access.path === "/");
    assert.ok(refreshCookie?.httpOnly && refreshCookie.sameSite === "Lax");
    assert.equal(refreshCookie.path, "/api/auth");
  });

  test("e-mail is case-insensitive for login and registration", async () => {
    await register();
    const duplicate = await register(EMAIL.toUpperCase());
    assert.equal(duplicate.res.statusCode, 409);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: `  ${EMAIL.toUpperCase()}`.trim(), password: PASSWORD },
    });
    assert.equal(login.statusCode, 200);
    assert.equal(login.json().token, undefined);
  });

  test("regex characters in an e-mail are matched literally, not as a pattern", async () => {
    assert.equal((await register("a.b+c@x.com")).res.statusCode, 201);
    for (const lookalike of ["aXb+c@x.com", "a.bbc@x.com", "a.b+c@x.co"]) {
      assert.equal((await register(lookalike)).res.statusCode, 201, lookalike);
    }
    assert.equal((await register("A.B+C@X.COM")).res.statusCode, 409);
  });

  test("unknown e-mail and wrong password give the same 401", async () => {
    await register();
    const unknown = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "nobody@example.com", password: PASSWORD },
    });
    const wrong = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: EMAIL, password: "wrong-password-1" },
    });
    assert.equal(unknown.statusCode, 401);
    assert.equal(wrong.statusCode, 401);
    assert.deepEqual(unknown.json(), wrong.json());
  });

  test("/me works with the access cookie and rejects requests without it", async () => {
    const { jar } = await register();
    const ok = await me(jar);
    assert.equal(ok.statusCode, 200);
    assert.deepEqual(Object.keys(ok.json()).sort(), ["email", "id"]);
    assert.equal((await me({})).statusCode, 401);
  });

  test("access tokens without tokenType or without exp are rejected", async () => {
    const { res } = await register();
    const { id } = res.json();
    const noType = app.jwt.sign({ id, email: EMAIL }, { expiresIn: 60 });
    const noExp = app.jwt.sign({ id, email: EMAIL, tokenType: "access" });
    for (const token of [noType, noExp]) {
      const r = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(r.statusCode, 401);
    }
  });

  test("the refresh token cannot be used as a Bearer access token", async () => {
    const { jar } = await register();
    const raw = app.unsignCookie(jar[REFRESH_COOKIE] ?? "").value ?? "";
    const r = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${raw}` },
    });
    assert.equal(r.statusCode, 401);
  });

  test("refresh rotates the token: the new one works, the old one does not", async () => {
    const { jar: first } = await register();
    const rotated = await refresh(first);
    assert.equal(rotated.statusCode, 200);
    const second = cookiesFrom(rotated);
    assert.notEqual(second[REFRESH_COOKIE], first[REFRESH_COOKIE]);
    assert.equal((await me(second)).statusCode, 200);

    // Within the grace period an old token just fails, without logging the user out
    assert.equal((await refresh(first)).statusCode, 401);
    assert.equal((await refresh(second)).statusCode, 200);
  });

  test("reusing an old refresh token after the grace period revokes every session", async () => {
    const { jar: first } = await register();
    const second = cookiesFrom(await refresh(first));
    await app.prisma.refreshToken.updateMany({
      where: { revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - GRACE_EXPIRED_MS) },
    });

    assert.equal((await refresh(first)).statusCode, 401);
    assert.equal(
      (await refresh(second)).statusCode,
      401,
      "the thief's replay must kill all sessions",
    );
  });

  test("parallel refreshes with the same token: exactly one succeeds", async () => {
    const { jar } = await register();
    const results = await Promise.all(
      Array.from({ length: PARALLEL_REFRESHES }, () => refresh(jar)),
    );
    const succeeded = results.filter((r) => r.statusCode === 200).length;
    assert.equal(succeeded, 1);
  });

  test("logout revokes the refresh token", async () => {
    const { jar } = await register();
    const out = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie: cookieHeader(jar) },
    });
    assert.equal(out.statusCode, 200);
    assert.equal((await refresh(jar)).statusCode, 401);
  });

  test("CORS allows only the exact configured origins", async () => {
    const preflight = (origin: string) =>
      app.inject({
        method: "OPTIONS",
        url: "/api/auth/me",
        headers: { origin, "access-control-request-method": "GET" },
      });
    const evil = await preflight("https://evil-attacker.vercel.app");
    assert.equal(evil.headers["access-control-allow-origin"], undefined);
    const own = await preflight("http://localhost:5173");
    assert.equal(own.headers["access-control-allow-origin"], "http://localhost:5173");
  });
});

describe("test database guard", () => {
  test("refuses a remote database or a non-test environment", () => {
    assert.throws(() =>
      assertLocalTestDatabase("mongodb+srv://user:pass@cluster0.example.mongodb.net/db", "test"),
    );
    assert.throws(() => assertLocalTestDatabase("mongodb://localhost:27019/db", "development"));
    assert.doesNotThrow(() => assertLocalTestDatabase("mongodb://localhost:27019/db", "test"));
  });
});
