import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";

export default fp(
  async (app) => {
    await app.register(rateLimit, {
      max: Number(process.env.RATE_LIMIT_MAX || 60),
      timeWindow: "1 minute",
      allowList: (req) => {
        const token = String(req.headers["x-admin-token"] ?? "");
        return Boolean(process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN);
      },
    });
  },
  { name: "rate-limit" },
);
