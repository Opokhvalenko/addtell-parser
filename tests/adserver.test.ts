import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { FastifyInstance } from "fastify";
import { closeTestApp, createTestApp } from "./setup.js";

let app: FastifyInstance;

test("AdServer Module - GET /api/bid should return 204 when no line items available", async () => {
  app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/bid?size=300x250",
    });

    assert.strictEqual(response.statusCode, 204);
  } finally {
    await closeTestApp(app);
  }
});

test("AdServer Module - GET /api/bid should require size parameter", async () => {
  app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/bid",
    });

    assert.strictEqual(response.statusCode, 400);
  } finally {
    await closeTestApp(app);
  }
});

test("AdServer Module - GET /api/bid should validate size format", async () => {
  app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/bid?size=invalid",
    });

    assert.strictEqual(response.statusCode, 400);
  } finally {
    await closeTestApp(app);
  }
});

test("AdServer Module - POST /api/ads/lineitems should require multipart data", async () => {
  app = await createTestApp();

  try {
    // Register and get token
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "test@example.com",
        password: "password123",
      },
    });

    const { token } = JSON.parse(registerResponse.payload);

    const response = await app.inject({
      method: "POST",
      url: "/api/ads/lineitems",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      payload: {
        name: "Test Line Item",
        sizes: "300x250",
        adType: "banner",
        geo: "US",
        minCpm: "1.0",
        maxCpm: "10.0",
        frequencyPerDay: "5",
        clickUrl: "https://example.com",
        html: "<div>Test creative</div>",
      },
    });

    assert.strictEqual(response.statusCode, 400);
    const body = JSON.parse(response.payload);
    assert.ok(body.message.includes("multipart/form-data"));
  } finally {
    await closeTestApp(app);
  }
});

test("AdServer Module - POST /api/ads/lineitems should require authentication", async () => {
  app = await createTestApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/ads/lineitems",
      headers: {
        "content-type": "application/json",
      },
      payload: {
        name: "Test Line Item",
        sizes: ["300x250"],
        adType: "banner",
      },
    });

    assert.strictEqual(response.statusCode, 401);
  } finally {
    await closeTestApp(app);
  }
});
