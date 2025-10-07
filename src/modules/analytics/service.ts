import type { ClickHouseClient } from "@clickhouse/client";
import type { FastifyInstance } from "fastify";
import type { BaseEvent, StatRow, StatsQuery } from "./types.js";

/* ───────────────────────────── helpers ──────────────────────────────── */
function toCHDateTime(input?: number | string | Date): string {
  const d =
    typeof input === "number"
      ? new Date(input)
      : input instanceof Date
        ? input
        : input
          ? new Date(input)
          : new Date();
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function toYMD(input: string | Date): string {
  const d = typeof input === "string" ? new Date(`${input}T00:00:00Z`) : input;
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

function chId(name: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe ClickHouse identifier: ${name}`);
  }
  return `\`${name}\``;
}

/** перетворює значення на масив рядків (прибирає undefined) */
function asStringArray(v: string | string[] | undefined, defCSV = ""): string[] {
  if (Array.isArray(v)) {
    return v.filter((s): s is string => typeof s === "string" && s.length > 0);
  }
  return (v ?? defCSV)
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is string => s.length > 0);
}

function extractAlias(expr: string): string {
  const parts = expr.split(/\s+AS\s+/i);
  const alias = parts[1];
  return alias ?? expr;
}

function buildOrderBy(orderBy: string | undefined, allowed: Set<string>, fallback: string) {
  if (!orderBy) return fallback;
  const cleaned = orderBy
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [fieldRaw, dirRaw] = p.split(/\s+/);
      const field = fieldRaw?.trim();
      if (!field || !allowed.has(field)) return "";
      const up = (dirRaw ?? "").toUpperCase();
      const dir = up === "ASC" || up === "DESC" ? up : "ASC";
      return `${field} ${dir}`;
    })
    .filter((s) => s.length > 0)
    .join(", ");
  return cleaned || fallback;
}

/* ─────────────────────── мапінги вимірів і метрик ───────────────────── */
const GROUPS = {
  day: "toDate(ts) AS day",
  hour: "toHour(ts) AS hour",
  event: "event",
  adapter: "adapter",
  adUnit: "adUnitCode",
  bidder: "bidder",
  creativeId: "creativeId",
} as const satisfies Record<string, string>;

const METRICS = {
  count: "count() AS count",
  requests: "countIf(event = 'bidRequested') AS requests",
  responses: "countIf(event = 'bidResponse') AS responses",
  wins: "countIf(event IN ('bidWon','win')) AS wins",
  cpmAvg: "avgIf(cpm, event IN ('bidWon','win')) AS cpmAvg",
  cpmP95: "quantileIf(0.95)(cpm, event IN ('bidWon','win')) AS cpmP95",
  revenue: "sumIf(cpm, event IN ('bidWon','win')) / 1000 AS revenue",
} as const satisfies Record<string, string>;

/* ── ключі та гард-функції для безпечної індексації */
type GroupKey = keyof typeof GROUPS;
type MetricKey = keyof typeof METRICS;

function isGroupKey(s: string): s is GroupKey {
  return s in GROUPS;
}
function isMetricKey(s: string): s is MetricKey {
  return s in METRICS;
}

/* ─────────────────────────── reporter (батч) ────────────────────────── */
export function createReporter(app: FastifyInstance) {
  const DB = app.config.CLICKHOUSE_DB || "adtell";
  const TABLE = app.config.CLICKHOUSE_TABLE || "events";
  const BATCH = Number(app.config.CH_BATCH_SIZE ?? 100);
  const FLUSH_MS = Number(app.config.CH_FLUSH_MS ?? 1000);

  let buf: BaseEvent[] = [];
  let timer: NodeJS.Timeout | null = null;
  let flushing = false;

  function startTimer() {
    if (!timer) {
      timer = setTimeout(async () => {
        timer = null;
        await flush();
      }, FLUSH_MS);
    }
  }

  async function flush() {
    if (flushing || buf.length === 0) return;

    const ch = app.clickhouse as ClickHouseClient | undefined;
    const payload = buf;
    buf = [];
    flushing = true;

    try {
      if (!ch) {
        app.log.debug({ n: payload.length }, "skip flush: no ClickHouse client");
        return;
      }
      await ch.insert({
        // у SDK немає поля `database`, даємо повне імʼя:
        table: `${DB}.${TABLE}`,
        values: payload.map((e) => ({
          ts: toCHDateTime(e.ts ?? new Date()),
          event: e.event,
          adapter: e.adapter ?? "",
          adUnitCode: e.adUnitCode ?? "",
          bidder: e.bidder ?? "",
          creativeId: String(e.creativeId ?? ""),
          cpm: typeof e.cpm === "number" ? e.cpm : 0,
          cur: e.cur ?? "USD",
          uid: e.uid ?? "",
          sid: e.sid ?? "",
          page: e.page ?? "",
          ref: e.ref ?? "",
          adomain: Array.isArray(e.adomain) ? e.adomain : [],
        })),
        format: "JSONEachRow",
      });
      app.metrics?.ingestCounter?.inc({ source: "api" }, payload.length);
    } catch (err) {
      app.log.error({ err }, "clickhouse insert failed, re-queue");
      buf = [...payload, ...buf];
    } finally {
      flushing = false;
    }
  }

  async function enqueue(ev: BaseEvent | BaseEvent[]) {
    const list = Array.isArray(ev) ? ev : [ev];
    buf.push(...list.filter(Boolean).map((e) => ({ ...e, ts: e.ts ?? new Date() })));
    if (buf.length >= BATCH) await flush();
    else startTimer();
  }

  const onExit = async () => {
    try {
      await flush();
    } catch {}
  };
  process.on("SIGINT", onExit);
  process.on("SIGTERM", onExit);

  return { enqueue, flushNow: flush };
}

/* ─────────────────────────── getStats (читання) ─────────────────────── */
export async function getStats(app: FastifyInstance, q: StatsQuery) {
  const client = app.clickhouse as ClickHouseClient | undefined;
  if (!client) return [] as StatRow[];

  // Дати: приймаємо і string ('YYYY-MM-DD'), і Date
  const fromStr = typeof q.from === "string" ? q.from : toYMD(q.from);
  const toStr = typeof q.to === "string" ? q.to : toYMD(q.to);

  // Межі інтервалу: [from 00:00:00; to+1d 00:00:00)
  const fromDT = toCHDateTime(new Date(`${fromStr}T00:00:00Z`));
  const toExclusiveDT = toCHDateTime(
    new Date(new Date(`${toStr}T00:00:00Z`).getTime() + 86400_000),
  );

  // ── Виміри (groupBy)
  const groupKeys = asStringArray(q.groupBy, "day,event,adapter").filter(isGroupKey);
  const groupExprs = groupKeys.map((g) => GROUPS[g]);
  const groupAliases = groupExprs.map(extractAlias);

  if (groupExprs.length === 0) {
    groupExprs.push(GROUPS.day);
    groupAliases.push("day");
  }

  // ── Метрики
  const metricKeys = asStringArray(q.metrics, "count,wins,cpmAvg").filter(isMetricKey);
  let metricExprs = metricKeys.map((m) => METRICS[m]);

  if (metricExprs.length === 0) {
    metricExprs = [METRICS.count];
  }

  // ORDER BY — тільки дозволені поля
  const allowedOrder = new Set<string>([...groupAliases, ...metricExprs.map(extractAlias)]);

  // безпечний фолбек, аби TS не бачив undefined
  const defaultMetricAlias = extractAlias(metricExprs[0] ?? METRICS.count);

  const orderExpr = buildOrderBy(
    q.orderBy,
    allowedOrder,
    `${groupAliases.join(", ")}${groupAliases.length ? ", " : ""}${defaultMetricAlias} DESC`,
  );

  const limit = Math.min(Math.max(Number(q.limit ?? 100), 1), 1000);
  const offset = Math.max(Number(q.offset ?? 0), 0);

  const DB = chId(app.config.CLICKHOUSE_DB || "adtell");
  const TABLE = chId(app.config.CLICKHOUSE_TABLE || "events");

  const sql = `
    SELECT
      ${groupExprs.join(", ")},
      ${metricExprs.join(", ")}
    FROM ${DB}.${TABLE}
    WHERE ts >= {from:DateTime} AND ts < {to:DateTime}
    ${groupAliases.length ? `GROUP BY ${groupAliases.join(", ")}` : ""}
    ORDER BY ${orderExpr}
    LIMIT {offset:UInt32}, {limit:UInt32}
  `;

  const res = await client.query({
    query: sql,
    format: "JSONEachRow",
    query_params: { from: fromDT, to: toExclusiveDT, offset, limit },
  });

  return (await res.json()) as StatRow[];
}
