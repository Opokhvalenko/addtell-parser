import type { FastifyPluginAsync } from "fastify";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/health",
    {
      schema: {
        summary: "Service health",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string", const: "ok" },
            },
            required: ["status"],
            additionalProperties: false,
          } as const,
        },
      },
    },
    async () => ({ status: "ok" }),
  );
};

export default healthRoutes;
