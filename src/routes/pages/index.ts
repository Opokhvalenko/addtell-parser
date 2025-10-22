import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
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
      await app.authenticate(req, reply);
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
    reply.header("cache-control", "no-store").type("text/html").send(html);
  };

  app.get("/create-lineitem", { config: { public: true } }, renderCreate);
  app.get("/api/create-lineitem", { config: { public: true } }, renderCreate);

  const debugGate = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await ensureAuth(req, reply))) return;
    reply.header("cache-control", "no-store").redirect(`${CLIENT_ORIGIN}/ads/debug`, 302);
  };

  app.get("/ads-debug", { config: { public: true } }, debugGate);
  app.get("/api/ads-debug", { config: { public: true } }, debugGate);

  const demoGate = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await ensureAuth(req, reply))) return;
    reply.header("cache-control", "no-store").redirect(`${CLIENT_ORIGIN}/ads/demo`, 302);
  };
  app.get("/demo", { config: { public: true } }, demoGate);
  app.get("/api/demo", { config: { public: true } }, demoGate);
};

export default pagesRoutes;
