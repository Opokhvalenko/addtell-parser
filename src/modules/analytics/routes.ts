import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { createReporter, getStats } from "./service.js";
import type { BaseEvent } from "./types.js";

function normalizeBody(body: unknown): BaseEvent[] {
  const parse = (v: unknown) => {
    if (typeof v === "string") {
      try {
        return JSON.parse(v);
      } catch {
        return undefined;
      }
    }
    return v;
  };
  const v = parse(body);
  if (Array.isArray(v)) return v as BaseEvent[];
  if (v && typeof v === "object") return [v as BaseEvent];
  return [];
}

const statsQuerySchema = {
  type: "object",
  properties: {
    from: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    to: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    groupBy: { type: "string" }, // "day,event,adapter"
    metrics: { type: "string" }, // "count,wins,cpmAvg"
  },
  required: ["from", "to"],
  additionalProperties: false,
} as const;

type GroupKey = "day" | "event" | "adapter";
type MetricKey = "count" | "wins" | "cpmAvg";

const isGroupBy = (v: string): v is GroupKey =>
  (["day", "event", "adapter"] as const).includes(v as GroupKey);

const isMetric = (v: string): v is MetricKey =>
  (["count", "wins", "cpmAvg"] as const).includes(v as MetricKey);

export default fp(
  async function analyticsRoutes(app: FastifyInstance) {
    if (app.analyticsRoutesRegistered) {
      app.log.warn("analytics routes already registered – skipping");
      return;
    }
    app.analyticsRoutesRegistered = true;

    const reporter = createReporter(app);

    app.register(
      async (r) => {
        r.get(
          "/health",
          { config: { public: true, rateLimit: false }, logLevel: "info" },
          async (_req, reply) => reply.send({ status: "ok", timestamp: new Date().toISOString() }),
        );

        r.get(
          "/stats",
          { schema: { querystring: statsQuerySchema }, logLevel: "info" },
          async (req) => {
            const q = req.query as { from: string; to: string; groupBy?: string; metrics?: string };
            const groupBy = (q.groupBy ?? "day")
              .split(",")
              .map((s) => s.trim())
              .filter(isGroupBy);
            const metrics = (q.metrics ?? "count")
              .split(",")
              .map((s) => s.trim())
              .filter(isMetric);

            const data = await getStats(app, {
              from: new Date(q.from),
              to: new Date(q.to),
              groupBy,
              metrics,
            });
            return { ok: true, from: q.from, to: q.to, data };
          },
        );

        r.post(
          "/events",
          {
            config: { public: true, rateLimit: false },
            logLevel: "info",
            bodyLimit: 10 * 1024 * 1024,
          },
          async (req, reply) => {
            const events = normalizeBody(req.body);
            if (!events.length) return reply.code(400).send({ error: "No valid events provided" });
            await reporter.enqueue(events);
            return reply.code(204).send();
          },
        );

        r.post(
          "/report",
          {
            config: { public: true, rateLimit: false },
            logLevel: "info",
            bodyLimit: 10 * 1024 * 1024,
          },
          async (req, reply) => {
            const events = normalizeBody(req.body);
            if (!events.length) return reply.code(400).send({ error: "No valid events provided" });
            await reporter.enqueue(events);
            return reply.code(204).send();
          },
        );
      },
      { prefix: "/api/analytics" },
    );
  },
  { name: "analytics-routes" },
);
