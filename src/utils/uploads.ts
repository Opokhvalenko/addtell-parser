import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";

export async function ensureUploadsDir(app: FastifyInstance): Promise<string> {
  const uploadsRoot = app.config?.UPLOADS_DIR || join(process.cwd(), "uploads");
  const uploadsDir = join(uploadsRoot, "creatives");
  await mkdir(uploadsDir, { recursive: true });
  return uploadsDir;
}
