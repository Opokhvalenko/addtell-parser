import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { ensureTtlIndex } from "../../utils/mongo-ttl.js";
import {
  EVENTS_BODY_LIMIT_BYTES,
  EventsBodySchema,
  type IncomingEvent,
  StatsQuerySchema,
  type StatsQueryString,
} from "./schemas.js";
import { createReporter, InvalidStatsQueryError, parseStatsQuery, toRow } from "./service.js";
import { type AnalyticsStore, clickhouseStore, mongoStore } from "./store.js";

const DAY_SECONDS = 86_400;
/** Per client IP; one request carries up to 100 events, the frontend flushes every ~1.5 s. */
const EVENTS_RATE_LIMIT = { max: 120, timeWindow: "1 minute" };

function pickStore(app: FastifyInstance): AnalyticsStore {
  if (app.config.ANALYTICS_STORE === "clickhouse") {
    if (app.clickhouse) return clickhouseStore(app, app.clickhouse);
    app.log.warn("ANALYTICS_STORE=clickhouse but no ClickHouse client, using MongoDB");
  }
  return mongoStore(app);
}

export default fp(
  async function analyticsRoutes(app: FastifyInstance) {
    const store = pickStore(app);
    const reporter = createReporter(app, store, {
      batchSize: app.config.ANALYTICS_BATCH_SIZE,
      flushMs: app.config.ANALYTICS_FLUSH_MS,
    });
    app.addHook("onClose", async () => reporter.flush());

    if (store.name === "mongo") {
      app.addHook("onReady", async () => {
        try {
          await ensureTtlIndex(
            app,
            "AnalyticsEvent",
            "ts",
            app.config.ANALYTICS_RETENTION_DAYS * DAY_SECONDS,
          );
        } catch (err) {
          app.log.error({ err }, "analytics: could not ensure the TTL index");
        }
      });
    }
    app.log.info({ store: store.name }, "analytics store");

    app.get("/api/analytics/health", { config: { public: true, rateLimit: false } }, async () => ({
      status: "ok",
    }));

    // Signed-in users only: aggregated over the whole site
    app.get<{ Querystring: StatsQueryString }>(
      "/api/analytics/stats",
      { schema: { querystring: StatsQuerySchema } },
      async (req) => {
        try {
          return await store.stats(parseStatsQuery(req.query));
        } catch (error) {
          if (error instanceof InvalidStatsQueryError)
            throw app.httpErrors.badRequest(error.message);
          throw error;
        }
      },
    );

    // Public: called by publisher pages (Prebid events, sendBeacon on unload)
    app.post<{ Body: IncomingEvent[] }>(
      "/api/analytics/events",
      {
        config: { public: true, rateLimit: EVENTS_RATE_LIMIT },
        bodyLimit: EVENTS_BODY_LIMIT_BYTES,
        schema: { body: EventsBodySchema },
      },
      async (req, reply) => {
        const now = new Date();
        reporter.enqueue(req.body.map((e) => toRow(e, now)));
        return reply.code(204).send();
      },
    );

    app.decorate("analyticsReporter", reporter);
  },
  { name: "analytics-routes" },
);
