import assert from "node:assert";
import { test } from "node:test";
import { closeTestApp, createTestApp } from "./setup";

test("Integration - Complete user flow", async () => {
  const app = await createTestApp();
  try {
    // 1. Register a new user
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "integration@example.com",
        password: "password123",
      },
    });

    assert.strictEqual(registerResponse.statusCode, 201);

    // 2. Login with the user
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "integration@example.com",
        password: "password123",
      },
    });

    assert.strictEqual(loginResponse.statusCode, 200);
    // The access token is only in the httpOnly cookie (signed value)
    const loginToken = loginResponse.cookies.find((c) => c.name === "token")?.value;
    assert.ok(loginToken);

    // 3. Get user info
    const meResponse = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        cookie: `token=${loginToken}`,
      },
    });

    assert.strictEqual(meResponse.statusCode, 200);
    const userInfo = meResponse.json() as { id: string; email: string };
    assert.strictEqual(userInfo.email, "integration@example.com");
    assert.ok(userInfo.id);

    // 4. Create a line item
    const lineItemResponse = await app.inject({
      method: "POST",
      url: "/api/adserver/line-items",
      headers: {
        cookie: `token=${loginToken}`,
      },
      payload: {
        name: "Integration Test Ad",
        sizes: ["300x250"],
        minCpm: 0.5,
        maxCpm: 2.0,
        geo: ["US", "UA"],
        adType: "banner",
        frequency: 3,
        clickUrl: "https://example.com",
        html: "<div>Test Ad</div>",
      },
    });

    assert.strictEqual(lineItemResponse.statusCode, 201);
    const lineItem = lineItemResponse.json() as { id: string };
    assert.ok(lineItem.id);

    // 5. Send analytics events (public, batched; stored by the background reporter)
    const analyticsResponse = await app.inject({
      method: "POST",
      url: "/api/analytics/events",
      payload: [{ event: "pageLoad", page: "https://example.com/test" }],
    });
    assert.strictEqual(analyticsResponse.statusCode, 204);
    await app.analyticsReporter.flush();

    // 6. Read the stats (signed-in users only)
    const today = new Date().toISOString().slice(0, 10);
    const statsResponse = await app.inject({
      method: "GET",
      url: `/api/analytics/stats?from=${today}&to=${today}&groupBy=event&metrics=count`,
      headers: { cookie: `token=${loginToken}` },
    });
    assert.strictEqual(statsResponse.statusCode, 200);
    assert.deepStrictEqual(statsResponse.json(), [{ event: "pageLoad", count: 1 }]);

    // 7. The own ad server answers a bid request with the line item created above
    const bidResponse = await app.inject({
      method: "GET",
      url: "/api/bid?size=300x250&geo=US",
    });
    assert.strictEqual(bidResponse.statusCode, 200);
    const bid = bidResponse.json() as { lineItemId: string; adm: string };
    assert.strictEqual(bid.lineItemId, lineItem.id);
    assert.ok(bid.adm.includes("Test Ad"));

    // Cleanup
    await app.prisma.analyticsEvent.deleteMany();
    await app.prisma.impression.deleteMany();
    await app.prisma.lineItem.deleteMany();
    await app.prisma.creative.deleteMany();
    await app.prisma.refreshToken.deleteMany();
    await app.prisma.user.deleteMany();
  } finally {
    await closeTestApp(app);
  }
});

test("Integration - Error handling flow", async () => {
  const app = await createTestApp();
  try {
    // Test invalid registration
    const invalidRegisterResponse = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "invalid-email",
        password: "123",
      },
    });

    assert.strictEqual(invalidRegisterResponse.statusCode, 400);

    // Test invalid login
    const invalidLoginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "nonexistent@example.com",
        password: "wrongpassword",
      },
    });

    assert.strictEqual(invalidLoginResponse.statusCode, 401);

    // Test unauthorized access
    const unauthorizedResponse = await app.inject({
      method: "GET",
      url: "/api/auth/me",
    });

    assert.strictEqual(unauthorizedResponse.statusCode, 401);

    // Broken JSON is a client error, not a crash
    const brokenJson = await app.inject({
      method: "POST",
      url: "/api/analytics/events",
      headers: { "content-type": "application/json" },
      payload: "[{ not json",
    });
    assert.strictEqual(brokenJson.statusCode, 400);

    // Plain text is parsed as a string, which is not a batch of events
    const plainText = await app.inject({
      method: "POST",
      url: "/api/analytics/events",
      headers: { "content-type": "text/plain" },
      payload: "pageLoad",
    });
    assert.strictEqual(plainText.statusCode, 400);
  } finally {
    await closeTestApp(app);
  }
});
