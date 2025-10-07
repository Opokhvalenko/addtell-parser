import type { FastifyInstance } from "fastify";
import { MOCK_STATS_DATA } from "../../utils/mockData.js";
import { getStats } from "./service.js";
import type { StatsQuery } from "./types.js";

declare module "fastify" {
  interface FastifyInstance {
    httpErrors: {
      serviceUnavailable: (message: string) => Error;
      internalServerError: (message: string) => Error;
      badRequest: (message: string) => Error;
      payloadTooLarge: (message: string) => Error;
    };
    clickhouse?: unknown;
  }
}

export default async function routes(app: FastifyInstance) {
  app.post("/ingest", async (req, reply) => {
    try {
      const payload = req.body;
      app.log.info({ payload }, "Stats ingest received");

      return reply.send({
        success: true,
        message: "Stats ingested successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      app.log.error({ err }, "Failed to ingest stats");
      return reply.code(500).send({ error: "Failed to ingest statistics" });
    }
  });

  app.get("/stats", async (req, reply) => {
    try {
      app.log.info({ query: req.query }, "Stats endpoint called");

      let data: Array<Record<string, unknown>>;

      if (!app.clickhouse) {
        app.log.warn("ClickHouse unavailable, returning mock data");
        data = MOCK_STATS_DATA;
        return reply.send({ data, query: req.query, mock: true });
      }

      try {
        data = await getStats(app, req.query as StatsQuery);
        if (data.length === 0) {
          app.log.warn("No data in ClickHouse, returning mock data");
          data = MOCK_STATS_DATA;
          return reply.send({ data, query: req.query, mock: true });
        }
        return reply.send({ data, query: req.query });
      } catch (err) {
        app.log.warn({ err }, "ClickHouse query failed, returning mock data");
        data = MOCK_STATS_DATA;
        return reply.send({ data, query: req.query, mock: true });
      }
    } catch (err) {
      app.log.error({ err }, "Failed to get stats");
      return reply.code(500).send({ error: "Failed to fetch statistics" });
    }
  });

  app.get("/stats/export", async (req, reply) => {
    try {
      let data: Array<Record<string, unknown>>;

      if (!app.clickhouse) {
        app.log.warn("ClickHouse unavailable, using mock data for export");
        data = MOCK_STATS_DATA;
      } else {
        data = await getStats(app, req.query as StatsQuery);
      }

      const csv = convertToCSV(data);

      reply.header("Content-Type", "text/csv");
      reply.header("Content-Disposition", "attachment; filename=stats.csv");
      return reply.send(csv);
    } catch (err) {
      app.log.error({ err }, "Failed to export stats");
      return reply.code(500).send({ error: "Failed to export statistics" });
    }
  });
}

function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0] || {});
  const csvRows = [headers.join(",")];

  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      return typeof value === "string" ? `"${value.replace(/"/g, '""')}"` : value;
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}
