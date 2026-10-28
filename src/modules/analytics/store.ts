import type { ClickHouseClient } from "@clickhouse/client";
import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { StatRow } from "./types.js";

/** One stored event; every field is filled, so both stores get the same shape. */
export type AnalyticsRow = {
  ts: Date;
  event: string;
  adapter: string;
  adUnitCode: string;
  bidder: string;
  creativeId: string;
  cpm: number;
  cur: string;
  uid: string;
  sid: string;
  page: string;
  ref: string;
  adomain: string[];
};

export const GROUP_KEYS = ["day", "event", "adapter"] as const;
export const METRIC_KEYS = ["count", "wins", "cpmAvg"] as const;
export type GroupKey = (typeof GROUP_KEYS)[number];
export type MetricKey = (typeof METRIC_KEYS)[number];

export type StatsRequest = {
  from: Date;
  /** Exclusive: the start of the day after the last requested day. */
  toExclusive: Date;
  groupBy: GroupKey[];
  metrics: MetricKey[];
  limit: number;
};

export interface AnalyticsStore {
  readonly name: "mongo" | "clickhouse";
  insert(rows: AnalyticsRow[]): Promise<void>;
  stats(query: StatsRequest): Promise<StatRow[]>;
}

const WIN_EVENTS = ["bidWon", "win"];

/** MongoDB (the same Atlas database as the rest of the app); old events expire via a TTL index. */
export function mongoStore(app: FastifyInstance): AnalyticsStore {
  return {
    name: "mongo",
    async insert(rows) {
      await app.prisma.analyticsEvent.createMany({ data: rows });
    },
    async stats(q) {
      const isWin: Prisma.InputJsonValue = { $in: ["$event", WIN_EVENTS] };
      const groupFields: Record<GroupKey, Prisma.InputJsonValue> = {
        day: { $dateToString: { format: "%Y-%m-%d", date: "$ts" } },
        event: "$event",
        adapter: "$adapter",
      };
      const metricFields: Record<MetricKey, Prisma.InputJsonValue> = {
        count: { $sum: 1 },
        wins: { $sum: { $cond: [isWin, 1, 0] } },
        // $avg skips nulls: only winning bids count towards the average CPM
        cpmAvg: { $avg: { $cond: [isWin, "$cpm", null] } },
      };

      const id = Object.fromEntries(q.groupBy.map((g) => [g, groupFields[g]]));
      const metrics = Object.fromEntries(q.metrics.map((m) => [m, metricFields[m]]));
      const project: Prisma.InputJsonObject = Object.fromEntries([
        ["_id", 0],
        ...q.groupBy.map((g) => [g, `$_id.${g}`]),
        ...q.metrics.map((m) => [m, 1]),
      ]);

      const rows = await app.prisma.analyticsEvent.aggregateRaw({
        pipeline: [
          {
            $match: {
              ts: {
                $gte: { $date: q.from.toISOString() },
                $lt: { $date: q.toExclusive.toISOString() },
              },
            },
          },
          { $group: { _id: id, ...metrics } },
          { $project: project },
          { $sort: Object.fromEntries(q.groupBy.map((g) => [g, 1])) },
          { $limit: q.limit },
        ],
      });
      return toStatRows(rows);
    },
  };
}

/** ClickHouse: used only when ANALYTICS_STORE=clickhouse (e.g. locally via docker-compose). */
export function clickhouseStore(app: FastifyInstance, client: ClickHouseClient): AnalyticsStore {
  const table = `${chId(app.config.CLICKHOUSE_DB || "adtell")}.${chId(app.config.CLICKHOUSE_TABLE || "events")}`;
  const groupExprs: Record<GroupKey, string> = {
    day: "toDate(ts) AS day",
    event: "event",
    adapter: "adapter",
  };
  const metricExprs: Record<MetricKey, string> = {
    count: "count() AS count",
    wins: "countIf(event IN ('bidWon','win')) AS wins",
    cpmAvg: "avgIf(cpm, event IN ('bidWon','win')) AS cpmAvg",
  };

  return {
    name: "clickhouse",
    async insert(rows) {
      await client.insert({
        table,
        values: rows.map((row) => ({ ...row, ts: toClickHouseDateTime(row.ts) })),
        format: "JSONEachRow",
      });
    },
    async stats(q) {
      const groups = q.groupBy.map((g) => groupExprs[g]);
      const sql = `
        SELECT ${[...groups, ...q.metrics.map((m) => metricExprs[m])].join(", ")}
        FROM ${table}
        WHERE ts >= {from:DateTime} AND ts < {to:DateTime}
        ${q.groupBy.length ? `GROUP BY ${q.groupBy.join(", ")} ORDER BY ${q.groupBy.join(", ")}` : ""}
        LIMIT {limit:UInt32}
      `;
      const res = await client.query({
        query: sql,
        format: "JSONEachRow",
        // Counts as JSON numbers, like the MongoDB store (ClickHouse quotes 64-bit integers)
        clickhouse_settings: { output_format_json_quote_64bit_integers: 0 },
        query_params: {
          from: toClickHouseDateTime(q.from),
          to: toClickHouseDateTime(q.toExclusive),
          limit: q.limit,
        },
      });
      return toStatRows(await res.json());
    },
  };
}

/** Keeps only scalar values: rows come from a database driver as untyped JSON. */
function toStatRows(rows: unknown): StatRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row && typeof row === "object" ? row : {}).map(([key, value]) => [
        key,
        typeof value === "string" || typeof value === "number" ? value : null,
      ]),
    ),
  );
}

function chId(name: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe ClickHouse identifier: ${name}`);
  }
  return `\`${name}\``;
}

/** `YYYY-MM-DD hh:mm:ss` in UTC, the format ClickHouse DateTime parameters expect. */
function toClickHouseDateTime(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}
