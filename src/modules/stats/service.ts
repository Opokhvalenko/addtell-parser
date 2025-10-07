import type { ClickHouseClient } from "@clickhouse/client";
import type { StatRow, StatsQuery } from "./types.js";

const DB = process.env.CLICKHOUSE_DB || "mydb";
const TABLE = process.env.CLICKHOUSE_TABLE || "events";

const GROUPS: Record<string, string> = {
  day: "toDate(ts) AS date",
  hour: "toHour(ts) AS hour",
  event: "event",
  adapter: "adapter",
  adUnit: "adUnitCode",
  bidder: "bidder",
  creativeId: "creativeId",
};

const METRICS: Record<string, string> = {
  count: "count() AS count",
  requests: "countIf(event='bidRequested') AS requests",
  responses: "countIf(event='bidResponse') AS responses",
  wins: "countIf(event='bidWon') AS wins",
  cpmAvg: "avgIf(cpm, event='bidWon') AS cpmAvg",
  cpmP95: "quantileIf(0.95)(cpm, event='bidWon') AS cpmP95",
  revenue: "sumIf(cpm, event='bidWon')/1000 AS revenue",
};

export async function getStats(ch: ClickHouseClient, q: StatsQuery) {
  const from = q.from || "1970-01-01";
  const to = q.to || "2100-01-01";

  const groups = (q.groupBy || "day,event,adapter")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const groupCols = groups.map((g) => GROUPS[g]).filter(Boolean) as string[];

  const metrics = (q.metrics || "count,wins,cpmAvg")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  const metricExprs = metrics.map((m) => METRICS[m]).filter(Boolean);
  if (metricExprs.length === 0) metricExprs.push(METRICS.count);

  const selectParts = [...groupCols, ...metricExprs].join(", ");
  const where = `ts >= toDateTime('${from} 00:00:00') AND ts < toDateTime('${to} 23:59:59')`;

  const groupBy = groupCols.map((c) => (c.includes(" AS ") ? c.split(" AS ")[1] : c)).join(", ");

  const order = q.orderBy ? q.orderBy : groupBy || metrics[0];
  const limit = Math.min(Math.max(Number(q.limit || 100), 1), 1000);
  const offset = Math.max(Number(q.offset || 0), 0);

  const sql = `
    SELECT ${selectParts}
    FROM ${DB}.${TABLE}
    WHERE ${where}
    ${groupBy ? `GROUP BY ${groupBy}` : ""}
    ORDER BY ${order}
    LIMIT ${offset}, ${limit}
  `;

  const res = await ch.query({ query: sql, format: "JSONEachRow" });
  const rows = (await res.json()) as StatRow[];
  return rows;
}
