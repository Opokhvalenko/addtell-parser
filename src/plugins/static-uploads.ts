import { mkdir } from "node:fs/promises";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import fp from "fastify-plugin";

export default fp(
  async (app) => {
    const dirFromEnv = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
    const root = path.isAbsolute(dirFromEnv) ? dirFromEnv : path.resolve(process.cwd(), dirFromEnv);

    await mkdir(root, { recursive: true });

    await app.register(fastifyStatic, {
      root,
      prefix: "/uploads/",
      decorateReply: false,
      cacheControl: false,
    });
  },
  { name: "static-uploads" },
);
