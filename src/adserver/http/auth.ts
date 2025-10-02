import type { FastifyReply, FastifyRequest } from "fastify";

type MaybeJwtReq = FastifyRequest & { jwtVerify?: () => Promise<void> };

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const r = req as MaybeJwtReq;
  if (typeof r.jwtVerify === "function") {
    try {
      await r.jwtVerify();
      return;
    } catch {
      // fall back to header token
    }
  }

  const token = (req.headers["x-admin-token"] as string | undefined) ?? undefined;
  if (process.env.ADMIN_TOKEN && token !== process.env.ADMIN_TOKEN) {
    return reply.code(401).type("text/html").send("<h1>Unauthorized</h1>");
  }
}
