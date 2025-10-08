import type { FastifyPluginAsync } from "fastify";
import { renderCreateLineItem } from "../../modules/adserver/ssr/pages/create-lineitem.js";

const pagesRoutes: FastifyPluginAsync = async (app) => {
  app.log.info("pages: routes loaded");

  app.get<{ Querystring: { token?: string } }>("/create-lineitem", async (req, reply) => {
    const token = req.query.token;

    if (token) {
      try {
        const decoded = app.jwt.verify(token) as { id: string; email: string };
        req.user = decoded;
      } catch (_err) {
        return reply.code(401).send({ error: "Invalid token" });
      }
    } else {
      try {
        await req.jwtVerify();
      } catch (_err) {
        return reply.code(401).send({ error: "Token required" });
      }
    }

    const html = renderCreateLineItem({ user: { email: req.user?.email || "test@example.com" } });
    return reply.type("text/html").send(html);
  });
};

export default pagesRoutes;
