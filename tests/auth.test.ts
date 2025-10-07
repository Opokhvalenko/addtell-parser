import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { FastifyInstance } from "fastify";
import { closeTestApp, createTestApp } from "./setup.js";

let app: FastifyInstance;

test("Auth Module - POST /auth/register should register a new user", async () => {
  app = await createTestApp();

  try {
    // Clear any existing data
    await app.prisma.lineItem.deleteMany();
    await app.prisma.creative.deleteMany();
    await app.prisma.user.deleteMany();

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "test@example.com",
        password: "password123",
      },
    });

    assert.strictEqual(response.statusCode, 201);
    const body = JSON.parse(response.payload);
    assert.ok(body.token);
  } finally {
    await closeTestApp(app);
  }
});

test("Auth Module - POST /auth/register should reject duplicate email", async () => {
  app = await createTestApp();

  try {
    // Clear any existing data
    await app.prisma.lineItem.deleteMany();
    await app.prisma.creative.deleteMany();
    await app.prisma.user.deleteMany();

    // First registration
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "test@example.com",
        password: "password123",
      },
    });

    // Second registration with same email
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "test@example.com",
        password: "password123",
      },
    });

    assert.strictEqual(response.statusCode, 409);
  } finally {
    await closeTestApp(app);
  }
});

test("Auth Module - POST /auth/register should validate email format", async () => {
  app = await createTestApp();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "invalid-email",
        password: "password123",
      },
    });

    assert.strictEqual(response.statusCode, 400);
  } finally {
    await closeTestApp(app);
  }
});

test("Auth Module - POST /auth/login should login with valid credentials", async () => {
  app = await createTestApp();

  try {
    // Clear any existing data
    await app.prisma.lineItem.deleteMany();
    await app.prisma.creative.deleteMany();
    await app.prisma.user.deleteMany();

    // Register a user first
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "test@example.com",
        password: "password123",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "test@example.com",
        password: "password123",
      },
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.ok(body.token);
  } finally {
    await closeTestApp(app);
  }
});

test("Auth Module - GET /auth/me should return user info with valid token", async () => {
  app = await createTestApp();

  try {
    // Clear any existing data
    await app.prisma.lineItem.deleteMany();
    await app.prisma.creative.deleteMany();
    await app.prisma.user.deleteMany();

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
      method: "GET",
      url: "/api/auth/me",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.ok(body.id);
    assert.strictEqual(body.email, "test@example.com");
    assert.ok(body.token);
  } finally {
    await closeTestApp(app);
  }
});
