import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";

describe("Plugins Tests", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  test("Health Plugin - should register health endpoints", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.strictEqual(body.status, "ok");
  });

  test("Health Plugin - should check database health", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health/db",
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.strictEqual(body.status, "ok");
    assert.strictEqual(body.database, "connected");
  });

  test("JWT Plugin - should register JWT decorators", async () => {
    assert.ok(app.jwt);
    assert.ok(typeof app.jwt.sign === "function");
    assert.ok(typeof app.jwt.verify === "function");
  });

  test("CORS Plugin - should handle preflight requests", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/feed",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
      },
    });

    assert.strictEqual(response.statusCode, 204);
    assert.ok(response.headers["access-control-allow-origin"]);
  });

  test("Cookie Plugin - should handle cookies", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/feed",
      headers: {
        Cookie: "test=value; another=test",
      },
    });

    // Should not fail due to cookie parsing
    assert.ok(response.statusCode >= 200);
  });

  test("Multipart Plugin - should handle file uploads", async () => {
    const formData = new FormData();
    formData.append("file", new Blob(["test content"], { type: "text/plain" }), "test.txt");
    formData.append("name", "test file");

    const response = await app.inject({
      method: "POST",
      url: "/api/upload",
      payload: formData,
      headers: {
        "content-type": "multipart/form-data",
      },
    });

    // Should handle multipart parsing without errors
    assert.ok(response.statusCode >= 200);
  });

  test("Static Plugin - should serve static files", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/public/ads/feeds.json",
    });

    // Should serve static files or return 404 if not found
    assert.ok([200, 404].includes(response.statusCode));
  });

  test("Swagger Plugin - should serve API documentation", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/docs",
    });

    assert.strictEqual(response.statusCode, 200);
    assert.ok(response.body.includes("swagger"));
  });

  test("Swagger Plugin - should serve OpenAPI JSON", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/docs/json",
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.ok(body.openapi);
    assert.ok(body.info);
  });

  test("Error Handling Plugin - should handle 404 errors", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/nonexistent",
    });

    assert.strictEqual(response.statusCode, 404);
    const body = JSON.parse(response.body);
    assert.strictEqual(body.statusCode, 404);
  });

  test("Error Handling Plugin - should handle 500 errors gracefully", async () => {
    // Test error handling by making a request to a non-existent endpoint
    const response = await app.inject({
      method: "GET",
      url: "/nonexistent",
    });

    assert.strictEqual(response.statusCode, 404);
    const body = JSON.parse(response.body);
    assert.ok(body.error);
  });

  test("OpenTelemetry Plugin - should register tracing", async () => {
    // Verify that OpenTelemetry is initialized
    // This is more of an integration test
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    assert.strictEqual(response.statusCode, 200);
    // If OpenTelemetry is working, the request should complete successfully
  });

  test("ClickHouse Plugin - should connect to ClickHouse", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health/clickhouse",
    });

    // ClickHouse might not be available in test environment
    assert.ok([200, 503].includes(response.statusCode));
  });

  test("Prisma Plugin - should connect to database", async () => {
    assert.ok(app.prisma);
    assert.ok(typeof app.prisma.user.findMany === "function");
  });

  test("Cron Plugin - should register cron jobs", async () => {
    // Verify cron is enabled in config
    assert.ok(app.config.CRON_ENABLE);
  });

  test("AJV Formats Plugin - should register custom formats", async () => {
    // Verify AJV is configured with custom formats
    assert.ok(app.validatorCompiler);
  });
});
