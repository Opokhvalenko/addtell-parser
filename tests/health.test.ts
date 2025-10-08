import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { FastifyInstance } from "fastify";
import { closeTestApp, createTestApp } from "./setup.js";

let app: FastifyInstance;

test("Health Endpoints - GET /health should return server health status", async () => {
  app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.status, "ok");
    assert.ok(body.timestamp);
  } finally {
    await closeTestApp(app);
  }
});

test("Health Endpoints - GET /health/db should return database health status", async () => {
  app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/health/db",
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.status, "ok");
    assert.strictEqual(body.database, "connected");
  } finally {
    await closeTestApp(app);
  }
});
