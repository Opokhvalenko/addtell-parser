import rateLimit, { type RateLimitPluginOptions } from "@fastify/rate-limit";
import type { FastifyRequest } from "fastify";
import fp from "fastify-plugin";

type RateLimitErrorContext = {
  after?: string | number | null;
  msBeforeNext?: number | null;
};

function clientIP(req: FastifyRequest): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") return xff.split(",")[0]?.trim() || req.ip;
  if (Array.isArray(xff)) return xff[0] || req.ip;
  return req.ip;
}

export default fp(async (app) => {
  const cfg = app.config as typeof app.config & {
    RATE_LIMIT_MAX?: number | string;
    RATE_LIMIT_WINDOW?: string | number;
  };

  const options: RateLimitPluginOptions = {
    max: Number(cfg.RATE_LIMIT_MAX ?? 60),
    timeWindow: String(cfg.RATE_LIMIT_WINDOW ?? "1 minute"),

    keyGenerator: (req) => clientIP(req as FastifyRequest),

    allowList: (req) => {
      const url = req.raw.url || "";
      return url.startsWith("/api/analytics") || url.startsWith("/metrics");
    },

    errorResponseBuilder(_request, context) {
      const ctx = context as unknown as RateLimitErrorContext;

      let afterMs: number | undefined;
      if (typeof ctx.msBeforeNext === "number" && Number.isFinite(ctx.msBeforeNext)) {
        afterMs = ctx.msBeforeNext;
      } else if (typeof ctx.after === "number" && Number.isFinite(ctx.after)) {
        afterMs = ctx.after;
      } else if (typeof ctx.after === "string") {
        const secs = Number(ctx.after);
        afterMs = Number.isFinite(secs) ? secs * 1000 : undefined;
      }
      if (afterMs === undefined) afterMs = 60_000;

      const minutes = Math.max(1, Math.ceil(afterMs / 60_000));
      return {
        code: 429,
        error: "Too Many Auth Attempts",
        message: `Too many authentication attempts, retry in ${minutes} minutes`,
        retryAfter: `${minutes} minutes`,
      };
    },
  };

  await app.register(rateLimit, options);
});
