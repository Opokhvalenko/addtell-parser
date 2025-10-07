import type { ClickHouseClient } from "@clickhouse/client";
import type { FastifyInstance } from "fastify";
import type { BaseEvent } from "./types.js";

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

/* ─────────────────────────── reporter (твій) ────────────────────────── */
export function createReporter(app: FastifyInstance) {
  const DB = app.config.CLICKHOUSE_DB;
  const TABLE = app.config.CLICKHOUSE_TABLE;
  const BATCH = app.config.CH_BATCH_SIZE;
  const FLUSH_MS = app.config.CH_FLUSH_MS;

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
        table: `${DB}.${TABLE}`,
        values: payload.map((e) => ({
          ts: toCHDateTime(e.ts),
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
    buf.push(...list.map((e) => ({ ...e, ts: e.ts ?? Date.now() })));
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

/* ─────────────────────────── stats (заглушка) ───────────────────────── */
export type Metric = "count" | "wins" | "cpmAvg";
export type GroupBy = "day" | "event" | "adapter";

export interface StatsQuery {
  from: Date;
  to: Date;
  groupBy: GroupBy[];
  metrics: Metric[];
}

export async function getStats(
  app: FastifyInstance,
  _q: StatsQuery,
): Promise<
  Array<{
    day?: string;
    event?: string;
    adapter?: string;
    count?: number;
    wins?: number;
    cpmAvg?: number;
  }>
> {
  const ch = app.clickhouse as ClickHouseClient | undefined;
  if (!ch) return [];
  return [];
}
