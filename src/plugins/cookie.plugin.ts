import { randomUUID } from "node:crypto";
import cookie from "@fastify/cookie";
import fp from "fastify-plugin";

const UID_COOKIE = "uid";

export default fp(
  async (app) => {
    const secret = app.config.COOKIE_SECRET ?? app.config.JWT_SECRET;
    await app.register(cookie, { secret, hook: "onRequest" });

    type MaybeCookieSecure = { COOKIE_SECURE?: "true" | "false" };
    const cfg = app.config as typeof app.config & MaybeCookieSecure;

    const secureCookies = cfg.NODE_ENV === "production" && cfg.COOKIE_SECURE !== "false";

    app.addHook("onRequest", async (req, reply) => {
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
              sameSite: "lax",
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
          sameSite: "lax",
          secure: secureCookies,
          maxAge: 60 * 60 * 24 * 365,
          signed: true,
        });
      }

      req.uid = id;
    });
  },
  { name: "cookie" },
);
