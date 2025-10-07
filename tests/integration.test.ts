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
    const { token } = registerResponse.json() as { token: string };
    assert.ok(token);

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
    const { token: loginToken } = loginResponse.json() as { token: string };
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
    const userInfo = meResponse.json() as { id: string; email: string; token: string };
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

    // 5. Send analytics event
    const analyticsResponse = await app.inject({
      method: "POST",
      url: "/api/analytics/events",
      payload: [
        {
          event: "page_view",
          ts: Date.now(),
          userId: userInfo.id,
          properties: {
            url: "/test",
            title: "Test Page",
          },
        },
      ],
    });

    assert.strictEqual(analyticsResponse.statusCode, 200);
    const analyticsResult = analyticsResponse.json() as { success: boolean; count: number };
    assert.strictEqual(analyticsResult.success, true);
    assert.strictEqual(analyticsResult.count, 1);

    // 6. Get stats
    const statsResponse = await app.inject({
      method: "GET",
      url: "/api/stats",
      headers: {
        cookie: `token=${loginToken}`,
      },
    });

    assert.strictEqual(statsResponse.statusCode, 200);
    const stats = statsResponse.json() as { data: any[] };
    assert.ok(Array.isArray(stats.data));

    // 7. Get feed
    const feedResponse = await app.inject({
      method: "GET",
      url: "/api/feed",
    });

    assert.strictEqual(feedResponse.statusCode, 200);
    const feed = feedResponse.json() as { items: any[] };
    assert.ok(Array.isArray(feed.items));

    // 8. Test bid request
    const bidResponse = await app.inject({
      method: "GET",
      url: "/api/bid?size=300x250&geo=US",
    });

    assert.strictEqual(bidResponse.statusCode, 200);
    const bid = bidResponse.json() as { bids: any[] };
    assert.ok(Array.isArray(bid.bids));

    // Cleanup
    await app.prisma.lineItem.deleteMany();
    await app.prisma.creative.deleteMany();
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

    // Test invalid analytics data
    const invalidAnalyticsResponse = await app.inject({
      method: "POST",
      url: "/api/analytics/events",
      payload: "invalid json",
    });

    assert.strictEqual(invalidAnalyticsResponse.statusCode, 400);
  } finally {
    await closeTestApp(app);
  }
});
