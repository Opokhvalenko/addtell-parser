import type { FastifyInstance } from "fastify";
import { type IncomingEvent, MAX_STATS_RANGE_DAYS, type StatsQueryString } from "./schemas.js";
import {
  type AnalyticsRow,
  type AnalyticsStore,
  GROUP_KEYS,
  type GroupKey,
  METRIC_KEYS,
  type MetricKey,
  type StatsRequest,
} from "./store.js";

const DAY_MS = 86_400_000;
const DEFAULT_STATS_LIMIT = 100;
/** Upper bound of events waiting in memory; beyond it new events are dropped, not queued. */
export const MAX_BUFFERED_EVENTS = 5000;

export class InvalidStatsQueryError extends Error {}

/** Server time, not the client's: a client timestamp could be anything (and broke inserts). */
export function toRow(e: IncomingEvent, now = new Date()): AnalyticsRow {
  return {
    ts: now,
    event: e.event,
    adapter: e.adapter ?? "",
    adUnitCode: e.adUnitCode ?? "",
    bidder: e.bidder ?? "",
    creativeId: e.creativeId == null ? "" : String(e.creativeId),
    cpm: e.cpm ?? 0,
    cur: e.cur ?? "USD",
    uid: e.uid ?? "",
    sid: e.sid ?? "",
    page: e.page ?? "",
    ref: e.ref ?? "",
    adomain: e.adomain ?? [],
  };
}

/**
 * Batches events in memory and writes them in the background. The buffer is bounded and a
 * failed write is logged and dropped, never put back: with a store that is down, re-queueing
 * made memory grow with every visitor until the process restarted.
 */
export function createReporter(
  app: FastifyInstance,
  store: AnalyticsStore,
  opts: { batchSize: number; flushMs: number; maxBuffered?: number },
) {
  const maxBuffered = opts.maxBuffered ?? MAX_BUFFERED_EVENTS;
  let buf: AnalyticsRow[] = [];
  let timer: NodeJS.Timeout | null = null;
  let flushing: Promise<void> | null = null;
  let dropped = 0;

  async function write(rows: AnalyticsRow[]) {
    try {
      await store.insert(rows);
      app.metrics?.ingestCounter.inc({ source: store.name }, rows.length);
    } catch (err) {
      app.log.error({ err, n: rows.length, store: store.name }, "analytics insert failed, dropped");
    }
  }

  async function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    // A loop, not one await: several callers may wait on the same write, and each must also
    // wait for the write started by the one that resumed first
    while (flushing) await flushing;
    if (buf.length === 0) return;
    const rows = buf;
    buf = [];
    if (dropped > 0) {
      app.log.warn({ dropped }, "analytics buffer full, events dropped");
      dropped = 0;
    }
    flushing = write(rows);
    await flushing;
    flushing = null;
  }

  function enqueue(rows: AnalyticsRow[]) {
    const room = Math.max(0, maxBuffered - buf.length);
    if (rows.length > room) dropped += rows.length - room;
    buf.push(...rows.slice(0, room));
    if (buf.length >= opts.batchSize) void flush();
    else if (!timer && buf.length > 0) {
      timer = setTimeout(() => void flush(), opts.flushMs);
      timer.unref();
    }
  }

  return { enqueue, flush, buffered: () => buf.length };
}

const csv = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Validates real calendar dates, `from <= to` and the maximum range. */
export function parseStatsQuery(q: StatsQueryString): StatsRequest {
  const from = new Date(`${q.from}T00:00:00Z`);
  const to = new Date(`${q.to}T00:00:00Z`);
  // V8 rolls impossible days over (`2026-04-31` becomes 1 May): compare back to the input
  const isReal = (d: Date, raw: string) =>
    !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === raw;
  if (!isReal(from, q.from) || !isReal(to, q.to)) {
    throw new InvalidStatsQueryError("from and to must be real dates (YYYY-MM-DD)");
  }
  if (from > to) throw new InvalidStatsQueryError("from must not be after to");
  const days = (to.getTime() - from.getTime()) / DAY_MS + 1;
  if (days > MAX_STATS_RANGE_DAYS) {
    throw new InvalidStatsQueryError(`The range must not exceed ${MAX_STATS_RANGE_DAYS} days`);
  }

  const groupBy = csv(q.groupBy ?? "day").filter((g): g is GroupKey =>
    (GROUP_KEYS as readonly string[]).includes(g),
  );
  const metrics = csv(q.metrics ?? "count").filter((m): m is MetricKey =>
    (METRIC_KEYS as readonly string[]).includes(m),
  );

  return {
    from,
    toExclusive: new Date(to.getTime() + DAY_MS),
    groupBy: groupBy.length ? [...new Set(groupBy)] : ["day"],
    metrics: metrics.length ? [...new Set(metrics)] : ["count"],
    limit: q.limit ?? DEFAULT_STATS_LIMIT,
  };
}
