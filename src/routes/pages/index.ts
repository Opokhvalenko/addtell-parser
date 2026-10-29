import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { renderCreateLineItem } from "../../modules/adserver/ssr/pages/create-lineitem.js";
import "@fastify/jwt";

type JwtUser = { id: string; email: string };

type CfgExtra = { APP_ORIGIN?: string };

const pagesRoutes: FastifyPluginAsync = async (app) => {
  const cfg = app.config as typeof app.config & CfgExtra;
  const CLIENT_ORIGIN = cfg.APP_ORIGIN || process.env.APP_ORIGIN || "http://localhost:5173";

  const redirectToLogin = (req: FastifyRequest, reply: FastifyReply) => {
    const clean = (req.raw.url ?? req.url).split("?")[0] || "/";
    const next = encodeURIComponent(clean);

    reply.redirect(`${CLIENT_ORIGIN}/login?next=${next}`, 302);
  };

  async function ensureAuth(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
    if (await app.verifyAccess(req)) return true;
    redirectToLogin(req, reply);
    return false;
  }

  const renderCreate = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await ensureAuth(req, reply))) return;
    const email = (req.user as JwtUser | undefined)?.email ?? "";
    const html = renderCreateLineItem({ user: { email } });
    reply.header("cache-control", "no-store").type("text/html").send(html);
  };

  app.get("/create-lineitem", { config: { public: true } }, renderCreate);
};

export default pagesRoutes;
