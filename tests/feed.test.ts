import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { FastifyInstance } from "fastify";
import { closeTestApp, createTestApp } from "./setup.js";

let app: FastifyInstance;

test("Feed Module - GET /api/feed should return feeds with default URL", async () => {
  app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/feed",
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.ok(body.title);
    assert.ok(body.url);
    assert.ok(Array.isArray(body.items));
  } finally {
    await closeTestApp(app);
  }
});

test("Feed Module - GET /api/feed should return feeds with custom URL", async () => {
  app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/feed?url=https://hnrss.org/frontpage",
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.ok(body.title);
    assert.strictEqual(body.url, "https://hnrss.org/frontpage");
    assert.ok(Array.isArray(body.items));
  } finally {
    await closeTestApp(app);
  }
});

test("Feed Module - GET /api/feed should force refresh when force=1", async () => {
  app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/feed?force=1",
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.ok(body.title);
    assert.ok(body.url);
    assert.ok(Array.isArray(body.items));
  } finally {
    await closeTestApp(app);
  }
});

test("Feed Module - GET /api/feed should validate URL format", async () => {
  app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/feed?url=invalid-url",
    });

    assert.strictEqual(response.statusCode, 400);
  } finally {
    await closeTestApp(app);
  }
});

test("Feed Module - GET /api/article/:id should return 404 for non-existent article", async () => {
  app = await createTestApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/article/non-existent-id",
    });

    assert.strictEqual(response.statusCode, 404);
  } finally {
    await closeTestApp(app);
  }
});
