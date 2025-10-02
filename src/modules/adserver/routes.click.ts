import type { FastifyPluginAsync } from "fastify";
import { metricsRepo } from "./repo/metricsRepo.js";

const ClickQuerySchema = {
  type: "object",
  properties: {
    li: { type: "string" },
    uid: { type: "string" },
  },
  additionalProperties: false,
} as const;

const HEX24 = /^[0-9a-f]{24}$/i;

const clickRoutes: FastifyPluginAsync = async (app) => {
  app.get("/click", { schema: { querystring: ClickQuerySchema } }, async (req, reply) => {
    const q = req.query as { li?: string; uid?: string };

    const li = q.li && HEX24.test(q.li) ? q.li : null;
    await metricsRepo(app).add("click", {
      uid: (q.uid ?? "anon").toString(),
      lineItemId: li,
    });

    return reply.code(204).send();
  });
};

export default clickRoutes;
