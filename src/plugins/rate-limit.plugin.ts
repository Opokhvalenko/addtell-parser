import rateLimit, { type RateLimitPluginOptions } from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

const TOO_MANY_REQUESTS = 429;
const DEFAULT_MAX = 60;
const DEFAULT_WINDOW = "1 minute";

const DEFAULT_AUTH_MAX = 10;
const AUTH_WINDOW = "1 minute";

/** Stricter limit for login/registration/refresh — the routes worth brute-forcing. */
export function authRateLimit(app: FastifyInstance) {
  const configured = (app.config as { AUTH_RATE_LIMIT_MAX?: number }).AUTH_RATE_LIMIT_MAX;
  return { max: configured ?? DEFAULT_AUTH_MAX, timeWindow: AUTH_WINDOW };
}

export default fp(async (app) => {
  const cfg = app.config as typeof app.config & {
    RATE_LIMIT_MAX?: number;
    RATE_LIMIT_WINDOW?: string;
  };

  const options: RateLimitPluginOptions = {
    max: cfg.RATE_LIMIT_MAX ?? DEFAULT_MAX,
    timeWindow: cfg.RATE_LIMIT_WINDOW ?? DEFAULT_WINDOW,
    // No custom keyGenerator: the default key is `req.ip`, which honours only the trusted proxy
    // hops (`trustProxy` in app.ts). A raw X-Forwarded-For header is set by the client.
    allowList: (req) => (req.raw.url ?? "").startsWith("/api/analytics"),
    errorResponseBuilder(_request, context) {
      return {
        statusCode: TOO_MANY_REQUESTS,
        error: "Too Many Requests",
        message: `Rate limit exceeded, retry in ${context.after}`,
      };
    },
  };

  await app.register(rateLimit, options);
});
