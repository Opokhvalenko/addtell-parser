import fp from "fastify-plugin";

export default fp(
  async (app) => {
    const safeAlias = (from: string, to = "/api/analytics/stats") => {
      if (typeof app.hasRoute === "function" && app.hasRoute({ method: "GET", url: from })) {
        app.log.warn({ from }, "[stats-alias] Skipping: route already exists");
        return;
      }

      app.get(from, { config: { public: true } }, async (req, reply) => {
        const raw = req.raw.url ?? "";
        const qsIndex = raw.indexOf("?");
        const qs = qsIndex >= 0 ? raw.slice(qsIndex) : "";
        const dest = `${to}${qs}`;

        return reply.redirect(dest, 308);
      });
    };

    safeAlias("/api/stats");
    safeAlias("/api/adserver/stats");
  },
  { name: "stats-alias" },
);
