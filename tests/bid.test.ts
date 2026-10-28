import { strict as assert } from "node:assert";
import { after, before, beforeEach, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { closeTestApp, createTestApp } from "./setup.js";

let app: FastifyInstance;
let owner = "";

async function signIn(email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, password: "password-123" },
  });
  return `token=${res.cookies.find((c) => c.name === "token")?.value ?? ""}`;
}

const createLineItem = (body: Record<string, unknown>) =>
  app.inject({
    method: "POST",
    url: "/api/adserver/line-items",
    headers: { cookie: owner },
    payload: { name: "Ad", sizes: ["300x250"], adType: "banner", html: "<b>ad</b>", ...body },
  });

/** A publisher page asking the own ad server for a 300x250 banner. */
const bid = (query = "size=300x250&type=banner", cookie?: string) =>
  app.inject({
    method: "GET",
    url: `/api/bid?${query}`,
    ...(cookie ? { headers: { cookie } } : {}),
  });

const uidCookie = (res: Awaited<ReturnType<typeof bid>>) => {
  const uid = res.cookies.find((c) => c.name === "uid");
  return uid ? `uid=${uid.value}` : "";
};

describe("own ad server: GET /api/bid", () => {
  before(async () => {
    app = await createTestApp();
  });
  after(async () => {
    await closeTestApp(app);
  });
  beforeEach(async () => {
    await app.prisma.impression.deleteMany();
    await app.prisma.lineItem.deleteMany();
    await app.prisma.creative.deleteMany();
    await app.prisma.refreshToken.deleteMany();
    await app.prisma.user.deleteMany();
    owner = await signIn("owner@example.com");
  });

  test("no line item for the size → 204", async () => {
    await createLineItem({});
    assert.equal((await bid("size=728x90&type=banner")).statusCode, 204);
  });

  test("frequency cap per visitor: the same uid is capped, a new visitor is not", async () => {
    const created = await createLineItem({ frequencyPerDay: 1 });
    assert.equal(created.statusCode, 201);

    const first = await bid();
    assert.equal(first.statusCode, 200);
    const visitor = uidCookie(first);
    assert.ok(visitor, "a signed uid cookie identifies the visitor");

    assert.equal((await bid(undefined, visitor)).statusCode, 204, "same visitor, over the cap");
    assert.equal((await bid()).statusCode, 200, "a new visitor still gets the ad");
  });

  test("a uid in the query cannot spend another visitor's cap", async () => {
    // A cap of 2 leaves room: honouring the query uid would put a 2nd impression on the victim
    await createLineItem({ frequencyPerDay: 2 });
    const visitor = uidCookie(await bid());
    // The cookie is signed; the impression stores the bare id
    const victimUid = String(app.unsignCookie(visitor.slice("uid=".length)).value);
    // Someone else names the visitor's uid in the query: it is not a known parameter
    await bid(`size=300x250&type=banner&uid=${encodeURIComponent(victimUid)}`);
    const victimImpressions = await app.prisma.impression.count({ where: { uid: victimUid } });
    assert.equal(victimImpressions, 1, "only the visitor's own impression is on the visitor's uid");
  });

  test("geo targeting: only the listed countries get the line item", async () => {
    await createLineItem({ geo: ["UA"] });
    assert.equal((await bid("size=300x250&type=banner&geo=US")).statusCode, 204);
    assert.equal((await bid("size=300x250&type=banner&geo=UA")).statusCode, 200);
  });
});
