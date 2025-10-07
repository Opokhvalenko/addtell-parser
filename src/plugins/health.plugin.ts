import type { ClickHouseClient } from "@clickhouse/client";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

function hasClickHouse(
  app: FastifyInstance,
): app is FastifyInstance & { clickhouse: ClickHouseClient } {
  const maybe = (app as unknown as { clickhouse?: unknown }).clickhouse;
  return !!maybe && typeof (maybe as { ping?: unknown }).ping === "function";
}

export default fp(
  async (app) => {
    app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

    app.get("/health/db", async (_request, reply) => {
      try {
        if (app.prisma) return { status: "ok", database: "connected" };
        reply.code(503);
        return { status: "error", database: "not configured" };
      } catch (error: unknown) {
        reply.code(503);
        const message = error instanceof Error ? error.message : "Unknown error";
        return { status: "error", database: "disconnected", error: message };
      }
    });

    app.get("/health/clickhouse", async (_request, reply) => {
      if (!hasClickHouse(app)) {
        reply.code(503);
        return { status: "error", clickhouse: "not configured" };
      }
      try {
        await app.clickhouse.ping();
        return { status: "ok", clickhouse: "connected" };
      } catch (error: unknown) {
        reply.code(503);
        const message = error instanceof Error ? error.message : "Unknown error";
        return { status: "error", clickhouse: "disconnected", error: message };
      }
    });

    app.log.info("Health plugin registered");
  },
  { name: "health" },
);
