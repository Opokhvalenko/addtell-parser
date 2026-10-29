import rateLimit, { type RateLimitOptions, type RateLimitPluginOptions } from "@fastify/rate-limit";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
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

const DEFAULT_LOGIN_PER_EMAIL_MAX = 10;
const LOGIN_PER_EMAIL_WINDOW = "15 minutes";
/**
 * Entries kept in memory (least recently used go first). The default 5000 would let anyone
 * evict an account's counter by trying 5000 made-up emails; one entry is ~100 bytes.
 */
const LOGIN_PER_EMAIL_TRACKED = 50_000;

/**
 * Login attempts per account, whatever the client address. The per-IP limit alone is spread
 * out by proxies: requests through the site reach this server from several Vercel addresses,
 * each with its own quota. Every attempt counts, so a flood can lock an account out for one
 * window; that is the price of not letting the password be guessed.
 *
 * `createRateLimit`, not `app.rateLimit`: the route's own limit has already marked the request
 * as limited, and a second `rateLimit` handler would skip it.
 */
export function loginPerEmailLimit(app: FastifyInstance, emailOf: (req: FastifyRequest) => string) {
  const configured = (app.config as { AUTH_EMAIL_RATE_LIMIT_MAX?: number })
    .AUTH_EMAIL_RATE_LIMIT_MAX;
  // `cache` is honoured by createRateLimit (it sizes the limiter's own store), though its
  // option type does not list it
  const options: RateLimitOptions = {
    max: configured ?? DEFAULT_LOGIN_PER_EMAIL_MAX,
    timeWindow: LOGIN_PER_EMAIL_WINDOW,
    cache: LOGIN_PER_EMAIL_TRACKED,
    keyGenerator: (req) => `login-email:${emailOf(req)}`,
  };
  const check = app.createRateLimit(options);
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await check(req);
    if (result.isAllowed || !result.isExceeded) return;
    reply.header("retry-after", result.ttlInSeconds);
    throw app.httpErrors.tooManyRequests("Too many login attempts, try again later");
  };
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
