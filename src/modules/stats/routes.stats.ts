import type { FastifyInstance } from "fastify";
import { getStats } from "./service.js";
import type { StatsQuery } from "./types.js";

export default async function routes(app: FastifyInstance) {
  app.get<{ Querystring: StatsQuery }>("/stats", async (req, reply) => {
    if (!app.clickhouse) return reply.code(503).send({ error: "clickhouse_unavailable" });

    try {
      const rows = await getStats(app.clickhouse, req.query);
      if (req.query.format === "csv") {
        const csv = toCsv(rows);
        return reply
          .type("text/csv; charset=utf-8")
          .header("Content-Disposition", 'attachment; filename="stats.csv"')
          .send(csv);
      }
      return reply.send({ rows });
    } catch (err) {
      app.log.error({ err, q: req.query }, "stats query failed");
      return reply.code(500).send({ error: "stats_failed", message: (err as Error).message });
    }
  });
}

function toCsv<T extends Record<string, unknown>>(rows: readonly T[]): string {
  if (!Array.isArray(rows) || rows.length === 0) return "";

  const headers = Object.keys(rows[0] as object) as Array<keyof T & string>;

  const esc = (v: unknown) =>
    v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);

  const lines = rows.map((r) => headers.map((h) => esc(r[h])).join(","));
  return [headers.join(","), ...lines].join("\n");
}
