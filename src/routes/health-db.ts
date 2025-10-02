import type { FastifyPluginAsync } from "fastify";
import { type Ok, OkSchema } from "../schemas/health.js";

function hasRunCommandRaw(
  client: object,
): client is { $runCommandRaw: (command: Record<string, unknown>) => Promise<unknown> } {
  const maybe = client as { $runCommandRaw?: unknown };
  return typeof maybe.$runCommandRaw === "function";
}

const healthDbRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: Ok }>(
    "/health/db",
    { schema: { summary: "DB health", response: { 200: OkSchema } } },
    async () => {
      const started = Date.now();
      try {
        if (hasRunCommandRaw(app.prisma)) {
          await app.prisma.$runCommandRaw({ ping: 1 });
        } else {
          // fallback для не-Mongo провайдерів
          await app.prisma.feed.count();
        }
        const ms = Date.now() - started;
        app.log.debug({ ms }, "db health ok");
        return { status: "ok" };
      } catch (err) {
        const ms = Date.now() - started;
        app.log.error({ err, ms }, "db health failed");
        // 503 логічніший для health
        throw app.httpErrors.serviceUnavailable("DB not reachable");
      }
    },
  );
};

export default healthDbRoute;
