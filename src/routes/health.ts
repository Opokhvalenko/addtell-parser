import type { FastifyPluginAsync } from "fastify";
import { type Ok, OkSchema } from "../schemas/health.js";

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: Ok }>(
    "/health",
    { schema: { summary: "Service health", response: { 200: OkSchema } } },
    async () => ({ status: "ok" }),
  );
};

export default healthRoutes;
