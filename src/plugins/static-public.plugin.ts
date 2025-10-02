import path from "node:path";
import fastifyStatic from "@fastify/static";
import fp from "fastify-plugin";

export default fp(
  async (app) => {
    const root = path.join(process.cwd(), "public");

    await app.register(fastifyStatic, {
      root,
      prefix: "/public/",
      index: false,
    });

    app.log.info({ root }, "static-public: enabled");
  },
  { name: "static-public" },
);
