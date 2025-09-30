import multipart from "@fastify/multipart";
import fp from "fastify-plugin";

export default fp(
  async (app) => {
    await app.register(multipart, {
      attachFieldsToBody: true,
      limits: { files: 1, fileSize: 10 * 1024 * 1024 },
    });
  },
  { name: "multipart" },
);
