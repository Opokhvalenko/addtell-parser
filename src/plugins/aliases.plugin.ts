import fp from "fastify-plugin";

export default fp(
  async (app) => {
    app.get("/feed", (_req, reply) => reply.redirect("/api/feed", 308));
    app.get("/me", (_req, reply) => reply.redirect("/api/auth/me", 308));
  },
  { name: "aliases" },
);
