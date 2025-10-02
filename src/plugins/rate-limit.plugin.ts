import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";

export default fp(async (app) => {
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    hook: "onRequest",
    allowList: (req) => Boolean(req.user),
  });
});
