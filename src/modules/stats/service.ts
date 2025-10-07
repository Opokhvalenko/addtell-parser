import type { ClickHouseClient } from "@clickhouse/client";
import type { FastifyInstance } from "fastify";
import type { StatRow, StatsQuery } from "./types.js";

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
function getDefaultFromDate(): string {
  return "1970-01-01";
}
function getDefaultToDate(): string {
  return "2100-01-01";
}

function getDefaultGroupBy(): string {
  return "day,event,adapter";
}
function getDefaultMetrics(): string {
  return "count,wins,cpmAvg";
}
function getDefaultLimit(): number {
  return 100;
}
function getDefaultOffset(): number {
  return 0;
}
function extractGroupByColumn(column: string): string {
  const parts = column.split(" AS ");
  return parts.length > 1 ? parts[1] || column : column;
}
function getOrderByClause(orderBy: string | undefined, groupBy: string, metrics: string[]): string {
  if (orderBy) {
    return orderBy;
  }
  return groupBy || (metrics[0] ?? "count");
}
export async function getStats(app: FastifyInstance, q: StatsQuery) {
  if (!app.clickhouse) {
    throw new Error("ClickHouse not available");
  }

  const DB = app.config.CLICKHOUSE_DB || "mydb";
  const TABLE = app.config.CLICKHOUSE_TABLE || "events";

  const from = q.from || getDefaultFromDate();
  const to = q.to || getDefaultToDate();
  const groups = (q.groupBy || getDefaultGroupBy())
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const groupCols = groups.map((g) => GROUPS[g]).filter(Boolean) as string[];
  const metrics = (q.metrics || getDefaultMetrics())
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const metricExprs = metrics.map((m) => METRICS[m]).filter(Boolean);
  if (metricExprs.length === 0) metricExprs.push(METRICS.count);
  const selectParts = [...groupCols, ...metricExprs].join(", ");
  const where = `ts >= toDateTime('${from} 00:00:00') AND ts < toDateTime('${to} 23:59:59')`;
  const groupBy = groupCols.map(extractGroupByColumn).join(", ");
  const order = getOrderByClause(q.orderBy, groupBy, metrics);
  const limit = Math.min(Math.max(Number(q.limit || getDefaultLimit()), 1), 1000);
  const offset = Math.max(Number(q.offset || getDefaultOffset()), 0);
  const sql = `
    SELECT ${selectParts}
    FROM ${DB}.${TABLE}
    WHERE ${where}
    ${groupBy ? `GROUP BY ${groupBy}` : ""}
    ORDER BY ${order}
    LIMIT ${offset}, ${limit}
  `;
  const ch = app.clickhouse as ClickHouseClient | undefined;
  if (!ch) return [];
  const res = await ch.query({ query: sql, format: "JSONEachRow" });
  const rows = (await res.json()) as StatRow[];
  return rows;
}
