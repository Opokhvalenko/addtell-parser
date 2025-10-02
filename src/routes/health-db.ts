import type { FastifyPluginAsync } from "fastify";
import { OkSchema } from "../schemas/health.js";

function hasRunCommandRaw(
  client: object,
): client is { $runCommandRaw: (command: Record<string, unknown>) => Promise<unknown> } {
  const maybe = client as { $runCommandRaw?: unknown };
  return typeof maybe.$runCommandRaw === "function";
}

const healthDbRoute: FastifyPluginAsync = async (fastify) => {
  const prisma = fastify.prisma;

  fastify.get(
    "/health/db",
    { schema: { summary: "DB health", response: { 200: OkSchema } } },
    async () => {
      try {
        if (hasRunCommandRaw(prisma)) {
          await prisma.$runCommandRaw({ ping: 1 });
        } else {
          await prisma.feed.count();
        }
        return { status: "ok" };
      } catch (e) {
        fastify.log.error(e);
        throw fastify.httpErrors.internalServerError("DB not reachable");
      }
    },
  );
};

export default healthDbRoute;
