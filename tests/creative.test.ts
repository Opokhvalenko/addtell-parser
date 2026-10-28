import { strict as assert } from "node:assert";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { after, before, beforeEach, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { detectImage, sanitizeCreativeHtml } from "../src/modules/adserver/creative.js";
import { closeTestApp, createTestApp } from "./setup.js";

/** A valid 1×1 PNG. */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const HTML_BYTES = Buffer.from("<html><script>alert(1)</script></html>");
const UPLOADS = join(process.cwd(), "uploads", "creatives");
const BOUNDARY = "----adtell-test-boundary";

let app: FastifyInstance;

describe("sanitizeCreativeHtml", () => {
  const removed: Array<[string, RegExp]> = [
    ["<script>alert(1)</script><b>x</b>", /script/i],
    ['<img src="https://x.test/a.png" onerror="alert(1)">', /onerror/i],
    ['<iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>', /iframe|srcdoc/i],
    ['<a href="javascript:alert(1)">x</a>', /javascript/i],
    ['<a href="java&#x73;cript:alert(1)">x</a>', /javascript|java&#x73;cript/i],
    ['<iframe src="data:text/html;base64,PHNjcmlwdD4="></iframe>', /iframe|data:text/i],
    ["<svg><script>alert(1)</script></svg>", /svg|script/i],
    ['<object data="https://x.test/a.swf"></object>', /object/i],
    ['<form action="https://evil.test"><input name="card"></form>', /form|input/i],
  ];
  for (const [input, forbidden] of removed) {
    test(`removes ${forbidden} from ${input.slice(0, 40)}`, () => {
      assert.doesNotMatch(sanitizeCreativeHtml(input), forbidden);
    });
  }

  test("keeps a normal image ad with an https link", () => {
    const html =
      '<a href="https://shop.test/" target="_blank"><img src="https://cdn.test/ad.png" alt="Sale"></a>';
    const clean = sanitizeCreativeHtml(html);
    assert.match(clean, /href="https:\/\/shop\.test\/"/);
    assert.match(clean, /src="https:\/\/cdn\.test\/ad\.png"/);
  });
});

describe("detectImage", () => {
  test("recognises a PNG by its bytes", () => {
    assert.equal(detectImage(PNG_1X1)?.ext, ".png");
  });
  test("rejects HTML regardless of the file name it came with", () => {
    assert.equal(detectImage(HTML_BYTES), null);
  });
});

function multipart(
  fields: Record<string, string>,
  file?: { name: string; type: string; bytes: Buffer },
) {
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }
  if (file) {
    parts.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="creative"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`,
      ),
      file.bytes,
      Buffer.from("\r\n"),
    );
  }
  parts.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return {
    payload: Buffer.concat(parts),
    headers: { "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
  };
}

async function signIn(email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, password: "password-123" },
  });
  return `token=${res.cookies.find((c) => c.name === "token")?.value ?? ""}`;
}

const lineItem = (cookie: string, body: Record<string, unknown>) =>
  app.inject({
    method: "POST",
    url: "/api/adserver/line-items",
    headers: { cookie },
    payload: { name: "Ad", sizes: ["300x250"], adType: "banner", geo: [], ...body },
  });

describe("creative routes", () => {
  let alice = "";
  let bob = "";

  before(async () => {
    app = await createTestApp();
  });
  after(async () => {
    await closeTestApp(app);
  });
  beforeEach(async () => {
    await app.prisma.lineItem.deleteMany();
    await app.prisma.creative.deleteMany();
    await app.prisma.refreshToken.deleteMany();
    await app.prisma.user.deleteMany();
    alice = await signIn("alice@example.com");
    bob = await signIn("bob@example.com");
  });

  test("HTML is sanitized before it is stored", async () => {
    const res = await lineItem(alice, {
      html: '<a href="https://shop.test/">Buy</a><iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>',
    });
    assert.equal(res.statusCode, 201);
    const creative = await app.prisma.creative.findFirst();
    assert.ok(creative?.html?.includes("https://shop.test/"));
    assert.doesNotMatch(creative?.html ?? "", /iframe|script/i);
  });

  test("HTML with nothing allowed is rejected", async () => {
    const res = await lineItem(alice, { html: "<script>alert(1)</script>" });
    assert.equal(res.statusCode, 400);
  });

  test("a path in the name never reaches the file system (HTML is stored only in the DB)", async () => {
    await mkdir(UPLOADS, { recursive: true });
    const before = await readdir(UPLOADS);
    const res = await lineItem(alice, { name: "../../../evil", html: "<b>ad</b>" });
    assert.equal(res.statusCode, 201);
    assert.deepEqual(await readdir(UPLOADS), before);
    const creative = await app.prisma.creative.findFirst();
    assert.equal(creative?.filename, "");
  });

  test("someone else's creative cannot be reused; an invalid id gives the same 404", async () => {
    await lineItem(alice, { html: "<b>alice</b>" });
    const aliceCreative = await app.prisma.creative.findFirst();
    for (const creativeId of [aliceCreative?.id ?? "", "not-an-object-id"]) {
      const res = await lineItem(bob, { creativeId });
      assert.equal(res.statusCode, 404, creativeId);
    }
    const own = await lineItem(alice, { creativeId: aliceCreative?.id });
    assert.equal(own.statusCode, 201);
  });

  test("invalid CPM is a 400, not a 500", async () => {
    const res = await lineItem(alice, { html: "<b>x</b>", minCpm: 5, maxCpm: 1 });
    assert.equal(res.statusCode, 400);
  });

  test("the form route parses multipart (no 415) and stores a real image under a server name", async () => {
    const form = multipart(
      { name: "Image ad", sizes: "300x250" },
      { name: "../../evil.png", type: "image/png", bytes: PNG_1X1 },
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/ads/lineitems",
      headers: { ...form.headers, cookie: alice },
      payload: form.payload,
    });
    assert.equal(res.statusCode, 201);
    const creative = await app.prisma.creative.findFirst();
    assert.match(creative?.filename ?? "", /^[0-9a-f-]{36}\.png$/);
    await rm(join(UPLOADS, creative?.filename ?? "missing"), { force: true });
  });

  test("HTML disguised as an image (name and MIME say PNG) is rejected", async () => {
    const form = multipart(
      { name: "Fake", sizes: "300x250" },
      { name: "ad.png", type: "image/png", bytes: HTML_BYTES },
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/ads/lineitems",
      headers: { ...form.headers, cookie: alice },
      payload: form.payload,
    });
    assert.equal(res.statusCode, 400);
    assert.equal(await app.prisma.creative.count(), 0);
  });

  test("/uploads serves only images, with nosniff and a sandbox CSP", async () => {
    await mkdir(UPLOADS, { recursive: true });
    const htmlFile = join(UPLOADS, "left-over.html");
    const pngFile = join(UPLOADS, "served.png");
    await writeFile(htmlFile, "<script>alert(1)</script>");
    await writeFile(pngFile, PNG_1X1);
    try {
      const html = await app.inject({ method: "GET", url: "/uploads/creatives/left-over.html" });
      assert.notEqual(html.statusCode, 200);
      const png = await app.inject({ method: "GET", url: "/uploads/creatives/served.png" });
      assert.equal(png.statusCode, 200);
      assert.equal(png.headers["x-content-type-options"], "nosniff");
      assert.match(String(png.headers["content-security-policy"]), /sandbox/);
    } finally {
      await rm(htmlFile, { force: true });
      await rm(pngFile, { force: true });
    }
  });
});
