import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import "@fastify/jwt";
import { renderCreateLineItem } from "../../modules/adserver/ssr/pages/create-lineitem.js";

type JwtUser = { id: string; email: string };

function readDeepLinkToken(req: FastifyRequest): string | undefined {
  const q = req.query as unknown;
  if (q && typeof q === "object" && "token" in q) {
    const v = (q as Record<string, unknown>).token;
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

const pagesRoutes: FastifyPluginAsync = async (app) => {
  app.log.info("pages: routes loaded");

  const isProd = app.config?.NODE_ENV === "production" || process.env.NODE_ENV === "production";
  const CLIENT_ORIGIN = app.config?.APP_ORIGIN || process.env.APP_ORIGIN || "http://localhost:5173";

  async function ensureAuth(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
    const token = readDeepLinkToken(req);

    if (token) {
      try {
        const decoded = app.jwt.verify<JwtUser>(token);
        (req as FastifyRequest & { user?: JwtUser }).user = decoded;
        return true;
      } catch {
        reply.code(401).send({ error: "Invalid token" });
        return false;
      }
    }

    try {
      await req.jwtVerify();
      return true;
    } catch {
      reply.code(401).send({ error: "Token required" });
      return false;
    }
  }

  const renderCreate = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await ensureAuth(req, reply))) return;

    const email = (req.user as JwtUser | undefined)?.email ?? "test@example.com";
    const html = renderCreateLineItem({ user: { email } });
    reply.type("text/html").send(html);
  };
  app.get("/create-lineitem", renderCreate);
  app.get("/api/create-lineitem", renderCreate);

  const debugGate = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await ensureAuth(req, reply))) return;

    if (!isProd) {
      reply.redirect(`${CLIENT_ORIGIN}/ads-debug`, 302);
    } else {
      reply.redirect("/ads/debug", 302);
    }
  };
  app.get("/ads-debug", debugGate);
  app.get("/api/ads-debug", debugGate);

  const sendSpa = async (_req: FastifyRequest, reply: FastifyReply) => {
    if (!isProd) {
      return reply.redirect(`${CLIENT_ORIGIN}/ads-debug`, 302);
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
