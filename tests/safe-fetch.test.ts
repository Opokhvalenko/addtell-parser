import { strict as assert } from "node:assert";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
  assertSafeUrl,
  isPublicAddress,
  safeFetch,
  UnsafeUrlError,
} from "../src/utils/safe-fetch.js";
import { closeTestApp, createTestApp } from "./setup.js";

const SMALL_LIMIT_BYTES = 1024;
const BIG_BODY_BYTES = 64 * 1024;
const SHORT_TIMEOUT_MS = 200;
const TIMEOUT_TOLERANCE = 5;
const DRIP_INTERVAL_MS = 50;
const LOOPBACK = "127.0.0.1";

describe("isPublicAddress", () => {
  const blocked = [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "not-an-ip",
  ];
  const allowed = ["8.8.8.8", "172.32.0.1", "1.1.1.1", "::ffff:8.8.8.8", "2606:4700:4700::1111"];

  for (const address of blocked) {
    test(`blocks ${address}`, () => assert.equal(isPublicAddress(address), false));
  }
  for (const address of allowed) {
    test(`allows ${address}`, () => assert.equal(isPublicAddress(address), true));
  }
});

describe("assertSafeUrl", () => {
  const rejected = [
    "ftp://example.com/feed",
    "file:///etc/passwd",
    "http://user:pass@example.com/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://0x7f.0.0.1/", // hex form of 127.0.0.1
    "http://2130706433/", // integer form of 127.0.0.1
    "http://169.254.169.254/latest/meta-data/",
    "not a url",
  ];
  for (const url of rejected) {
    test(`rejects ${url}`, () => assert.throws(() => assertSafeUrl(url), UnsafeUrlError));
  }

  test("accepts a normal https URL", () => {
    assert.equal(assertSafeUrl("https://hnrss.org/frontpage").hostname, "hnrss.org");
  });
});

describe("safeFetch", () => {
  let server: Server;
  let base = "";
  const allowLoopbackOnly = (address: string) => address === LOOPBACK;

  before(async () => {
    server = createServer((req, res) => {
      if (req.url === "/big") return res.end("x".repeat(BIG_BODY_BYTES));
      if (req.url === "/big-chunked") {
        // No Content-Length: only the streaming byte counter can stop it
        res.write("x".repeat(BIG_BODY_BYTES / 2));
        return res.end("x".repeat(BIG_BODY_BYTES / 2));
      }
      if (req.url === "/slow") return; // never answers
      if (req.url === "/declared-huge") {
        // Announces a body far over the limit, then sends nothing
        res.writeHead(200, { "content-length": String(BIG_BODY_BYTES) });
        res.flushHeaders();
        return;
      }
      if (req.url === "/drip") {
        // One byte at a time: an idle timeout alone would never fire
        const drip = setInterval(() => res.write("x"), DRIP_INTERVAL_MS);
        res.on("close", () => clearInterval(drip));
        return;
      }
      if (req.url === "/loop") {
        res.writeHead(302, { location: "/loop" });
        return res.end();
      }
      if (req.url === "/to-other-host") {
        const { port } = server.address() as AddressInfo;
        res.writeHead(302, { location: `http://127.0.0.2:${port}/ok` });
        return res.end();
      }
      res.setHeader("content-type", "text/plain");
      res.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, LOOPBACK, resolve));
    base = `http://${LOOPBACK}:${(server.address() as AddressInfo).port}`;
  });
  after(() => {
    server.closeAllConnections();
    server.close();
  });

  test("hostnames are checked after DNS resolution (localhost → 127.0.0.1)", async () => {
    const { port } = server.address() as AddressInfo;
    await assert.rejects(safeFetch(`http://localhost:${port}/ok`), UnsafeUrlError);
  });

  test("fetches an allowed address", async () => {
    const res = await safeFetch(`${base}/ok`, { isAllowedAddress: allowLoopbackOnly });
    assert.equal(res.status, 200);
    assert.equal(res.body, "ok");
  });

  test("stops reading a body over the size limit", async () => {
    await assert.rejects(
      safeFetch(`${base}/big`, {
        isAllowedAddress: allowLoopbackOnly,
        maxBytes: SMALL_LIMIT_BYTES,
      }),
      /too large/,
    );
  });

  test("refuses a declared Content-Length over the limit without waiting for the body", async () => {
    await assert.rejects(
      safeFetch(`${base}/declared-huge`, {
        isAllowedAddress: allowLoopbackOnly,
        maxBytes: SMALL_LIMIT_BYTES,
        timeoutMs: SHORT_TIMEOUT_MS,
      }),
      /too large/,
    );
  });

  test("stops a chunked body (no Content-Length) over the size limit", async () => {
    await assert.rejects(
      safeFetch(`${base}/big-chunked`, {
        isAllowedAddress: allowLoopbackOnly,
        maxBytes: SMALL_LIMIT_BYTES,
      }),
      /too large/,
    );
  });

  test("gives up on an upstream that does not answer, after the configured timeout", async () => {
    const startedAt = Date.now();
    await assert.rejects(
      safeFetch(`${base}/slow`, {
        isAllowedAddress: allowLoopbackOnly,
        timeoutMs: SHORT_TIMEOUT_MS,
      }),
      /timed out/,
    );
    // Node's default agent would also time out, but only after 5 s
    assert.ok(Date.now() - startedAt < SHORT_TIMEOUT_MS * TIMEOUT_TOLERANCE);
  });

  test("a slow-drip upstream is cut off by the total deadline, not kept alive byte by byte", async () => {
    const startedAt = Date.now();
    await assert.rejects(
      safeFetch(`${base}/drip`, {
        isAllowedAddress: allowLoopbackOnly,
        timeoutMs: SHORT_TIMEOUT_MS,
      }),
      /timed out/,
    );
    assert.ok(Date.now() - startedAt < SHORT_TIMEOUT_MS * TIMEOUT_TOLERANCE);
  });

  test("limits redirects", async () => {
    await assert.rejects(
      safeFetch(`${base}/loop`, { isAllowedAddress: allowLoopbackOnly, maxRedirects: 2 }),
      /Too many redirects/,
    );
  });

  test("checks the target of every redirect", async () => {
    await assert.rejects(
      safeFetch(`${base}/to-other-host`, { isAllowedAddress: allowLoopbackOnly }),
      UnsafeUrlError,
    );
  });
});

describe("feed and article routes", () => {
  let app: FastifyInstance;

  before(async () => {
    app = await createTestApp();
  });
  after(async () => {
    await closeTestApp(app);
  });

  test("/api/feed refuses URLs outside the configured sources", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/feed?url=${encodeURIComponent("http://169.254.169.254/latest/meta-data/")}`,
    });
    assert.equal(res.statusCode, 400);
    assert.equal(await app.prisma.feed.count(), 0, "nothing may be stored for a refused URL");
  });

  test("/api/article requires a session", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/article?url=${encodeURIComponent("https://example.com/")}`,
    });
    assert.equal(res.statusCode, 401);
  });

  test("/api/article refuses internal addresses for a signed-in user", async () => {
    const register = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "ssrf@example.com", password: "password-123" },
    });
    const token = register.cookies.find((c) => c.name === "token")?.value ?? "";
    const res = await app.inject({
      method: "GET",
      url: `/api/article?url=${encodeURIComponent("http://127.0.0.1:1/")}`,
      headers: { cookie: `token=${token}` },
    });
    assert.equal(res.statusCode, 400);
  });
});
