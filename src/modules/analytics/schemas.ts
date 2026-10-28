/**
 * Ingest and stats contracts. The ingest endpoint is public (publisher pages call it without a
 * session), so every field is typed and bounded: what is not described here is stripped, and
 * a request outside these limits is a 400 instead of something stored or kept in memory.
 */

export const MAX_EVENTS_PER_REQUEST = 100;
export const EVENTS_BODY_LIMIT_BYTES = 256 * 1024;
export const MAX_CPM = 1000;
export const MAX_STATS_RANGE_DAYS = 90;

const text = (maxLength: number) => ({ type: ["string", "null"], maxLength }) as const;

export const AnalyticsEventSchema = {
  type: "object",
  required: ["event"],
  additionalProperties: false,
  properties: {
    event: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_.:-]{0,63}$" },
    adapter: text(64),
    adUnitCode: text(128),
    bidder: text(64),
    creativeId: { type: ["string", "number", "null"], maxLength: 128 },
    cpm: { type: ["number", "null"], minimum: 0, maximum: MAX_CPM },
    cur: { type: ["string", "null"], pattern: "^[A-Z]{3}$" },
    uid: text(64),
    sid: text(64),
    page: text(2048),
    ref: text(2048),
    adomain: { type: "array", maxItems: 10, items: { type: "string", maxLength: 253 } },
  },
} as const;

export const EventsBodySchema = {
  type: "array",
  minItems: 1,
  maxItems: MAX_EVENTS_PER_REQUEST,
  items: AnalyticsEventSchema,
} as const;

const DATE = "^\\d{4}-\\d{2}-\\d{2}$";

export const StatsQuerySchema = {
  type: "object",
  required: ["from", "to"],
  additionalProperties: false,
  properties: {
    from: { type: "string", pattern: DATE },
    to: { type: "string", pattern: DATE },
    groupBy: { type: "string", maxLength: 64 },
    metrics: { type: "string", maxLength: 64 },
    limit: { type: "integer", minimum: 1, maximum: 1000 },
  },
} as const;

export type IncomingEvent = {
  event: string;
  adapter?: string | null;
  adUnitCode?: string | null;
  bidder?: string | null;
  creativeId?: string | number | null;
  cpm?: number | null;
  cur?: string | null;
  uid?: string | null;
  sid?: string | null;
  page?: string | null;
  ref?: string | null;
  adomain?: string[];
};

export type StatsQueryString = {
  from: string;
  to: string;
  groupBy?: string;
  metrics?: string;
  limit?: number;
};
