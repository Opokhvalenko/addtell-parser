import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp({
    logger: { level: "silent" },
  });

  await app.ready();

  // Clear database before each test
  await app.prisma.adEvent.deleteMany();
  await app.prisma.creative.deleteMany();
  await app.prisma.lineItem.deleteMany();
  await app.prisma.feedItem.deleteMany();
  await app.prisma.feed.deleteMany();
  await app.prisma.user.deleteMany();

  return app;
}

export async function closeTestApp(app: FastifyInstance): Promise<void> {
  if (app) {
    await app.close();
  }
}
