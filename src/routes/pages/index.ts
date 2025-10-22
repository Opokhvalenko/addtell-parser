import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import "@fastify/jwt";
import { renderCreateLineItem } from "../../modules/adserver/ssr/pages/create-lineitem.js";

/** User payload we expect inside JWT */
type JwtUser = { id: string; email: string };

/** Safely read ?token=... from query without `any` */
function readDeepLinkToken(req: FastifyRequest): string | undefined {
  const q = req.query as unknown;
  if (q && typeof q === "object" && "token" in q) {
    const v = (q as Record<string, unknown>).token;
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

/** Attach decoded user to request in a typed way (no `any`) */
function setReqUser(req: FastifyRequest, user: JwtUser) {
  (req as FastifyRequest & { user?: JwtUser }).user = user;
}

/** Build absolute client URL preserving path (used in dev redirects) */
function clientUrl(clientOrigin: string, path: string): string {
  return new URL(path, clientOrigin).toString();
}

const pagesRoutes: FastifyPluginAsync = async (app) => {
  app.log.info("pages: routes loaded");

  const isProd = app.config?.NODE_ENV === "production" || process.env.NODE_ENV === "production";

  const CLIENT_ORIGIN = app.config?.APP_ORIGIN || process.env.APP_ORIGIN || "http://localhost:5173";

  /** Common auth guard (401 on failure) */
  async function ensureAuth(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
    // 1) Deep link token (?token=...)
    const token = readDeepLinkToken(req);
    if (token) {
      try {
        const decoded = app.jwt.verify<JwtUser>(token);
        setReqUser(req, decoded);
        return true;
      } catch {
        reply.code(401).send({ error: "Invalid token" });
        return false;
      }
    }

    // 2) Normal cookie/Authorization header
    try {
      await req.jwtVerify();
      return true;
    } catch {
      reply.code(401).send({ error: "Token required" });
      return false;
    }
  }

  /* ───────────────────── Create Line Item (SSR inside iframe) ───────────────────── */
  const renderCreate = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await ensureAuth(req, reply))) return;

    const email = (req.user as JwtUser | undefined)?.email ?? "test@example.com";
    const html = renderCreateLineItem({ user: { email } });
    reply.type("text/html; charset=utf-8").send(html);
  };

  app.get("/create-lineitem", renderCreate);
  app.get("/api/create-lineitem", renderCreate);

  /* ───────────────────────────── Debug gate (auth → redirect) ───────────────────── */
  const debugGate = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await ensureAuth(req, reply))) return;

    if (!isProd) {
      reply.redirect(clientUrl(CLIENT_ORIGIN, "/ads-debug"), 302);
    } else {
      reply.redirect("/ads/debug", 302);
    }
  };

  app.get("/ads-debug", debugGate);
  app.get("/api/ads-debug", debugGate);

  /* ───────────── Optional universal gate: /ads-gate/:page → /ads/:page ──────────── */
  app.get<{ Params: { page: string } }>("/ads-gate/:page", async (req, reply) => {
    if (!(await ensureAuth(req, reply))) return;
    const page = req.params.page.replace(/[^a-zA-Z0-9/_-]/g, "");
    const dest = `/ads/${page}`;
    reply.redirect(isProd ? dest : clientUrl(CLIENT_ORIGIN, dest), 302);
  });

  /* ───────────────────────────── Serve SPA (prod) / proxy (dev) ──────────────────── */
  const sendSpa = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!isProd) {
      const path = String(req.url).replace(/^\/api/, "");
      return reply.redirect(clientUrl(CLIENT_ORIGIN, path), 302);
    }
    return reply.sendFile("index.html");
  };

  app.get("/ads/debug", sendSpa);
  app.get("/api/ads/debug", sendSpa);

  app.get("/ads", sendSpa);
  app.get("/ads/*", sendSpa);
  app.get("/api/ads", sendSpa);
  app.get("/api/ads/*", sendSpa);
};

export default pagesRoutes;
