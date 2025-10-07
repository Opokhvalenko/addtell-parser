import type { FastifyInstance } from "fastify";

export default async function routes(app: FastifyInstance) {
  if (typeof app.authenticate !== "function") {
    app.log.warn("`app.authenticate` missing — /create is public");
    app.get("/create", async (_req, reply) => {
      const { renderCreateLineItem } = await import("./ssr/pages/create-lineitem.js");
      return reply.type("text/html").send(renderCreateLineItem({}));
    });
    return;
  }

  app.get("/create", { preHandler: app.authenticate }, async (req, reply) => {
    const { renderCreateLineItem } = await import("./ssr/pages/create-lineitem.js");

    const props = req.user?.email ? { user: { email: req.user.email } } : {};
    return reply.type("text/html").send(renderCreateLineItem(props));
  });
}
