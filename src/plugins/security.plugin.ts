import helmet from "@fastify/helmet";
import fp from "fastify-plugin";

export default fp(async (app) => {
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
  });
});
