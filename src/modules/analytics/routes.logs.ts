import type { FastifyInstance } from "fastify";

export default async function routes(app: FastifyInstance) {
  app.post("/logs", async (req, reply) => {
    const body = (req.body ?? null) as unknown;
    app.log.info({ log: body }, "client-log");
    return reply.code(204).send();
  });
}
