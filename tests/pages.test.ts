import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { closeTestApp, createTestApp } from "./setup.js";

const TAILWIND_CSS = "/public/assets/tw-embed.css";

let app: FastifyInstance;

describe("server-rendered line-item form", () => {
  before(async () => {
    app = await createTestApp();
    await app.prisma.refreshToken.deleteMany();
    await app.prisma.user.deleteMany();
  });
  after(async () => {
    await closeTestApp(app);
  });

  test("loads Tailwind in the document head, not only inside the shadow root", async () => {
    const register = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "form@example.com", password: "password-123" },
    });
    assert.equal(register.statusCode, 201);
    const token = register.cookies.find((c) => c.name === "token")?.value ?? "";

    const res = await app.inject({
      method: "GET",
      url: "/create-lineitem",
      headers: { cookie: `token=${token}` },
    });
    assert.equal(res.statusCode, 200);
    // Browsers ignore @property inside a shadow root: without the document-level copy the
    // gradient of the submit button has no value and its white text is invisible
    const headEnd = res.body.indexOf("</head>");
    assert.ok(headEnd > 0, "the page has a head");
    const head = res.body.slice(0, headEnd);
    assert.match(head, new RegExp(`<link rel="stylesheet" href="${TAILWIND_CSS}`));
  });

  test("the stylesheet it links is served", async () => {
    const res = await app.inject({ method: "GET", url: TAILWIND_CSS });
    assert.equal(res.statusCode, 200);
    assert.match(String(res.headers["content-type"]), /text\/css/);
    assert.match(res.body, /@property --tw-gradient-from/);
  });
});
