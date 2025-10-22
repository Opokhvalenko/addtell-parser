import cookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import "@fastify/jwt";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
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
      });
    }

    if (!app.hasDecorator("authenticate")) {
      app.decorate("authenticate", async (req, reply) => {
        try {
          if (req.cookies?.[cookieName] && !req.headers.authorization) {
            await req.jwtVerify({ onlyCookie: true });
          } else {
            await req.jwtVerify();
          }
        } catch {
          return reply.unauthorized();
        }
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
