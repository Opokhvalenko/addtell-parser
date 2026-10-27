import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Tests wipe collections, so they must never touch a shared or production database. */
export function assertLocalTestDatabase(
  databaseUrl: string | undefined,
  nodeEnv: string | undefined,
) {
  const host = databaseUrl ? new URL(databaseUrl).hostname : "";
  if (nodeEnv !== "test" || !LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run tests: NODE_ENV must be "test" and DATABASE_URL must point to localhost (got NODE_ENV=${nodeEnv}, host=${host || "none"})`,
    );
  }
}

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp({
    logger: { level: "silent" },
  });

  await app.ready();

  try {
    assertLocalTestDatabase(app.config.DATABASE_URL, app.config.NODE_ENV);
  } catch (error) {
    await app.close();
    throw error;
  }

  // Clear database before each test
  // Children before parents: line items reference creatives
  await app.prisma.adEvent.deleteMany();
  await app.prisma.lineItem.deleteMany();
  await app.prisma.creative.deleteMany();
  await app.prisma.feedItem.deleteMany();
  await app.prisma.feed.deleteMany();
  await app.prisma.refreshToken.deleteMany();
  await app.prisma.user.deleteMany();

  return app;
}

export async function closeTestApp(app: FastifyInstance): Promise<void> {
  if (app) {
    await app.close();
  }
}
