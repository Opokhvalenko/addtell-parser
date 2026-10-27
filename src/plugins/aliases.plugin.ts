import fp from "fastify-plugin";

export default fp(
  async (app) => {
    const redirectOnly = { config: { public: true } };
    app.get("/feed", redirectOnly, (_req, reply) => reply.redirect("/api/feed", 308));
    app.get("/me", redirectOnly, (_req, reply) => reply.redirect("/api/auth/me", 308));
  },
  { name: "aliases" },
);
