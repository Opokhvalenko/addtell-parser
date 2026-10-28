import path from "node:path";
import fastifyStatic from "@fastify/static";
import fp from "fastify-plugin";

/** Uploaded creatives are images only; anything else in the folder is never served. */
const SERVED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

export default fp(
  async (app) => {
    const root = path.join(process.cwd(), "uploads");
    await app.register(fastifyStatic, {
      root,
      prefix: "/uploads/",
      decorateReply: false,
      index: false,
      allowedPath: (pathName) => SERVED_EXTENSIONS.has(path.extname(pathName).toLowerCase()),
      // nosniff + a sandbox CSP for these files are set in security-headers.plugin.ts
      setHeaders: (reply) => reply.header("X-Content-Type-Options", "nosniff"),
    });
    app.log.info({ root }, "static-uploads: enabled");
  },
  { name: "static-uploads" },
);
