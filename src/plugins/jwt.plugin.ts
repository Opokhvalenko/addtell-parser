import cookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import "@fastify/jwt";
import { ACCESS_TOKEN_TYPE, type AccessPayload } from "../modules/auth/session.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** True when the request carries a valid, unexpired access token (cookie or Bearer). */
    verifyAccess: (req: FastifyRequest) => Promise<boolean>;
  }
}

type CfgExtra = {
  JWT_COOKIE?: string;
  COOKIE_SECRET?: string;
  JWT_SECRET?: string;
  APP_ORIGIN?: string;
  NODE_ENV?: string;
  COOKIE_SECURE?: "true" | "false";
};

export default fp(
  async (app) => {
    const cfg = app.config as typeof app.config & CfgExtra;

    const cookieName = cfg.JWT_COOKIE ?? "token";
    const cookieSecret = cfg.COOKIE_SECRET;
    const jwtSecret = cfg.JWT_SECRET;
    if (!cookieSecret) throw new Error("COOKIE_SECRET is required");
    if (!jwtSecret) throw new Error("JWT_SECRET is required");

    if (!app.hasDecorator("setCookie")) {
      await app.register(cookie, { secret: cookieSecret, hook: "onRequest" });
    }
    if (!app.hasDecorator("jwt")) {
      await app.register(fastifyJwt, {
        secret: jwtSecret,
        cookie: { cookieName, signed: true },
        // A token without an expiry is never accepted, even if correctly signed
        verify: { requiredClaims: ["exp"] },
      });
    }

    if (!app.hasDecorator("verifyAccess")) {
      app.decorate("verifyAccess", async (req: FastifyRequest) => {
        try {
          const payload =
            req.cookies?.[cookieName] && !req.headers.authorization
              ? await req.jwtVerify<AccessPayload>({ onlyCookie: true })
              : await req.jwtVerify<AccessPayload>();
          return payload.tokenType === ACCESS_TOKEN_TYPE;
        } catch {
          return false;
        }
      });
    }

    if (!app.hasDecorator("authenticate")) {
      app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
        if (!(await app.verifyAccess(req))) return reply.unauthorized();
      });
    }
    const PUBLIC_EXACT = new Set<string>(["/", "/favicon.ico", "/robots.txt"]);
    const PUBLIC_PREFIXES = [
      "/health",
      "/docs",
      "/docs/json",
      "/docs/yaml",
      "/public",
      "/uploads",
      "/assets/tw-embed.css",

      "/api/analytics",
      "/api/stats",
      "/api/adserver/stats",

      "/feed",
      "/api/feed",
      "/api/article",
      "/api/bid",
      "/api/analytics/events",
      "/api/analytics/stats",

      "/auth/login",
      "/auth/register",
      "/auth/logout",
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/logout",
    ];

    const PROTECTED_PREFIXES = [
      "/ads-debug",
      "/create-lineitem",
      "/demo",
      "/api/ads-debug",
      "/api/create-lineitem",
      "/api/demo",
      "/api/ads",
    ];

    const CLIENT_ORIGIN = cfg.APP_ORIGIN || process.env.APP_ORIGIN || "http://localhost:5173";

    app.addHook("preHandler", async (req, reply) => {
      if (req.method === "OPTIONS") return;

      const clean = (req.raw.url ?? req.url).split("?")[0] || "";

      if (PUBLIC_EXACT.has(clean)) return;

      if (req.routeOptions?.config?.public === true) return;

      if (PUBLIC_PREFIXES.some((p) => clean.startsWith(p))) return;

      try {
        await app.authenticate(req, reply);
      } catch {
        if (PROTECTED_PREFIXES.some((p) => clean.startsWith(p))) {
          const next = clean.replace(/^\/api/, "");
          return reply.redirect(`${CLIENT_ORIGIN}/login?next=${encodeURIComponent(next)}`, 302);
        }
        return reply.unauthorized();
      }
    });
  },
  { name: "jwt" },
);
