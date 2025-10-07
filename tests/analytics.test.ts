import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { FastifyInstance } from "fastify";
import { closeTestApp, createTestApp } from "./setup.js";

let app: FastifyInstance;

test("Analytics Module - POST /api/analytics/events should accept valid events array", async () => {
  app = await createTestApp();

  try {
    const events = [
      {
        type: "page_view",
        timestamp: Date.now(),
        data: { page: "/home" },
      },
      {
        type: "click",
        timestamp: Date.now(),
        data: { element: "button" },
      },
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/analytics/events",
      headers: {
        "content-type": "application/json",
      },
      payload: events,
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.status, "ok");
  } finally {
    await closeTestApp(app);
  }
});

test("Analytics Module - POST /api/analytics/events should accept events as JSON string", async () => {
  app = await createTestApp();

  try {
    const events = [
      {
        type: "page_view",
        timestamp: Date.now(),
        data: { page: "/home" },
      },
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/analytics/events",
      headers: {
        "content-type": "application/json",
      },
      payload: JSON.stringify(events),
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.status, "ok");
  } finally {
    await closeTestApp(app);
  }
});

test("Analytics Module - POST /api/analytics/events should reject empty events", async () => {
  app = await createTestApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/analytics/events",
      headers: {
        "content-type": "application/json",
      },
      payload: [],
    });

    assert.strictEqual(response.statusCode, 400);
  } finally {
    await closeTestApp(app);
  }
});

test("Analytics Module - GET /api/analytics/health should return health status", async () => {
  app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/analytics/health",
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.status, "ok");
  } finally {
    await closeTestApp(app);
  }
});
