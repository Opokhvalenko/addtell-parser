import type { FastifyError, FastifyInstance } from "fastify";
import fp from "fastify-plugin";

export default fp(
  async (fastify: FastifyInstance) => {
    fastify.setErrorHandler((err: FastifyError, _req, reply) => {
      const status = typeof err.statusCode === "number" ? err.statusCode : 500;
      reply.code(status).send({ error: err.name, message: err.message });
    });
  },
  { name: "error-handler" },
);
