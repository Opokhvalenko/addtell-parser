import type { FastifyPluginAsync } from "fastify";

const health: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health/server", async () => ({ status: "ok" }));
  fastify.get("/health/db", async (req, reply) => {
    try {
      // @ts-ignore Mongo only
      const res = await fastify.prisma.$runCommandRaw({ ping: 1 });
      return { status: res?.ok === 1 ? "ok" : "unknown" };
    } catch (e) {
      req.log.error(e);
      return reply.code(503).send({ status: "error", message: "db unavailable" });
    }
  });
};
export default health;