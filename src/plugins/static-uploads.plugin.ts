import path from "node:path";
import fastifyStatic from "@fastify/static";
import fp from "fastify-plugin";
export default fp(
  async (app) => {
    const root = path.join(process.cwd(), "uploads");
    await app.register(fastifyStatic, {
      root,
      prefix: "/uploads/",
      decorateReply: false,
      index: false,
    });
    app.log.info({ root }, "static-uploads: enabled");
  },
  { name: "static-uploads" },
);
