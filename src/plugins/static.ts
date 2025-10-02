import { mkdir } from "node:fs/promises";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import fp from "fastify-plugin";

export default fp(
  async (app) => {
    const root = path.join(process.cwd(), "public");
    await mkdir(root, { recursive: true });
    await app.register(fastifyStatic, { root, prefix: "/" });
    app.log.info({ root }, "static: enabled");
  },
  { name: "static" },
);
