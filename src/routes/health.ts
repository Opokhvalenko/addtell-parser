import type { FastifyPluginAsync } from "fastify";
import { OkSchema } from "../schemas/health.js";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/health",
    { schema: { summary: "Service health", response: { 200: OkSchema } } },
    async () => ({ status: "ok" }),
  );
};

export default healthRoutes;
