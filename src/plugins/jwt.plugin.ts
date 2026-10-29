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
    /**
     * Deny by default: every route needs a valid access token unless it is marked
     * `config: { public: true }`. The only other exceptions are the static file mounts
     * (public assets by design — a missing file answers 404) and the API docs.
     */
    const PUBLIC_STATIC_ROUTES = new Set(["/public/*", "/uploads/*"]);
    const DOCS_ROUTE = "/docs";
    const isDocsRoute = (route: string) =>
      route === DOCS_ROUTE || route.startsWith(`${DOCS_ROUTE}/`);

    // onRequest, not preHandler: the session is checked before the body is parsed and
    // validated, so anonymous callers never learn a route's schema from 400 errors
    app.addHook("onRequest", async (req, reply) => {
      if (req.method === "OPTIONS") return;

      const route = req.routeOptions?.url;
      // No matched route: the 404 handler answers
      if (route === undefined) return;
      if (req.routeOptions.config?.public === true) return;
      if (PUBLIC_STATIC_ROUTES.has(route) || isDocsRoute(route)) return;

      // Return the reply (Fastify's rule for async hooks). The old preHandler version did not,
      // and unauthenticated requests to the static wildcard route hung.
      if (!(await app.verifyAccess(req))) return reply.unauthorized();
    });
  },
  { name: "jwt" },
);
