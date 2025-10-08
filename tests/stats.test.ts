import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { FastifyInstance } from "fastify";
import { closeTestApp, createTestApp } from "./setup.js";

let app: FastifyInstance;

test("Stats Module - GET /api/stats should return stats data", async () => {
  app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/stats",
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.ok(body.data && Array.isArray(body.data));
  } finally {
    await closeTestApp(app);
  }
});

test("Stats Module - GET /api/stats should accept query parameters", async () => {
  app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/stats?startDate=2024-01-01&endDate=2024-12-31&eventType=page_view",
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.ok(body.data && Array.isArray(body.data));
  } finally {
    await closeTestApp(app);
  }
});

test("Stats Module - GET /api/stats/export should return CSV export", async () => {
  app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/stats/export?format=csv",
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.headers["content-type"], "text/csv");
  } finally {
    await closeTestApp(app);
  }
});
