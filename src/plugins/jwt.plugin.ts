import cookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(
  async (app) => {
    const cookieName = app.config.JWT_COOKIE ?? "token";
    const cookieSecret = app.config.COOKIE_SECRET;
    const jwtSecret = app.config.JWT_SECRET;
    if (!cookieSecret) throw new Error("COOKIE_SECRET is required");
    if (!jwtSecret) throw new Error("JWT_SECRET is required");

    if (!app.hasDecorator("setCookie")) {
      await app.register(cookie, { secret: cookieSecret, hook: "onRequest" });
    } else {
      app.log.warn("cookie already registered – skipping");
    }

    if (!app.hasDecorator("jwt")) {
      await app.register(fastifyJwt, {
        secret: jwtSecret,
        cookie: { cookieName, signed: true },
      });
    } else {
      app.log.warn("jwt already registered – skipping");
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

    const PUBLIC_PREFIXES = [
      "/health",
      "/docs",
      "/public",
      "/uploads",
      "/assets/tw-embed.css",

      // аналітика
      "/api/analytics",
      "/api/stats",
      "/api/adserver/stats",

      // решта
      "/api/feed",
      "/api/article",
      "/create-lineitem",
    ];

    app.addHook("onRequest", async (req, reply) => {
      if (req.method === "OPTIONS") return;

      const clean = (req.raw.url ?? req.url).split("?")[0] ?? "";
      if (PUBLIC_PREFIXES.some((p) => clean.startsWith(p))) return;

      if (req.routeOptions?.config?.public === true) return;

      return app.authenticate(req, reply);
    });
  },
  { name: "jwt" },
);
