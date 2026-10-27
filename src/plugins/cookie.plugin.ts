import { randomUUID } from "node:crypto";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyRequest {
    uid?: string;
  }
}

const UID_COOKIE = "uid";
/**
 * The anonymous id is needed only for frequency capping in the bid route. Setting it on every
 * response would also put it on long-cached static files, where a shared cache could hand one
 * id to every visitor.
 */
const UID_ROUTES = new Set(["/api/bid"]);

type CfgExtra = { COOKIE_SECURE?: "true" | "false"; APP_ORIGIN?: string };

export default fp(
  async (app) => {
    const cfg = app.config as typeof app.config & CfgExtra;
    const isProd = cfg.NODE_ENV === "production";
    const secureCookies = isProd && cfg.COOKIE_SECURE !== "false";
    const sameSite: "lax" | "none" =
      isProd && !(cfg.APP_ORIGIN ?? "").includes("localhost") ? "none" : "lax";

    app.addHook("onRequest", async (req, reply) => {
      if (!UID_ROUTES.has(req.routeOptions?.url ?? "")) return;
      const raw = req.cookies?.[UID_COOKIE] as string | undefined;
      let id: string | undefined;

      if (raw) {
        const { valid, value, renew } = req.unsignCookie(raw);
        if (valid) {
          id = String(value);
          if (renew) {
            reply.setCookie(UID_COOKIE, id, {
              path: "/",
              httpOnly: true,
              sameSite,
              secure: secureCookies,
              maxAge: 60 * 60 * 24 * 365,
              signed: true,
            });
          }
        }
      }
      if (!id) {
        id = randomUUID();
        reply.setCookie(UID_COOKIE, id, {
          path: "/",
          httpOnly: true,
          sameSite,
          secure: secureCookies,
          maxAge: 60 * 60 * 24 * 365,
          signed: true,
        });
      }
      req.uid = id;
    });
  },
  { name: "uid-cookie", dependencies: ["jwt"] },
);
