import type { FastifyReply, FastifyRequest } from "fastify";

export async function adminGuard(req: FastifyRequest, reply: FastifyReply) {
  const token = (req.headers["x-admin-token"] || req.headers["x-admin"]) as string | undefined;
  if (!process.env.ADMIN_TOKEN || token === process.env.ADMIN_TOKEN) return;
  reply.code(401).send({ error: "unauthorized" });
}
