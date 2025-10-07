import type { FastifyInstance } from "fastify";
import type { BaseEvent } from "./types.js";

const DB = process.env.CLICKHOUSE_DB || "mydb";
const TABLE = process.env.CLICKHOUSE_TABLE || "events";
const BATCH = Number(process.env.CH_BATCH_SIZE || 200);
const FLUSH_MS = Number(process.env.CH_FLUSH_MS || 2000);

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
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
  );
}

export function createReporter(app: FastifyInstance) {
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
    const ch = app.clickhouse;
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

      app.metrics?.ingestCounter.inc({ source: "api" }, payload.length);
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
