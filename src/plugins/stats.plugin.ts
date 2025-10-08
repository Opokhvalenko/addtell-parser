import path from "node:path";
import fastifyStatic from "@fastify/static";
import fp from "fastify-plugin";

export default fp(
  async (app) => {
    await app.register(fastifyStatic, {
      root: path.join(process.cwd(), "public"),
      prefix: "/",
      cacheControl: true,
      maxAge: "1y",
      immutable: true,
      decorateReply: false,
    });
    app.log.info("Static plugin registered");
  },
  { name: "static" },
);
