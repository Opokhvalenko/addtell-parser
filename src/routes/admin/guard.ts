import type { preHandlerHookHandler } from "fastify";

/** Якщо ADMIN_TOKEN не заданий — гард вимкнено */
export const adminGuard: preHandlerHookHandler = async (req, reply) => {
  const required = process.env.ADMIN_TOKEN;
  if (!required) return;

  const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const header = (req.headers["x-admin-token"] as string | undefined) ?? "";
  const token = bearer || header;

  if (token !== required) {
    return reply.code(401).send({ error: "unauthorized" });
  }
};
