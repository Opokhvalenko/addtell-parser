import cors from "@fastify/cors";
import fp from "fastify-plugin";

const VERCEL_RE = /^https:\/\/(?:[a-z0-9-]+\.)?vercel\.app$/i;

export default fp(async (app) => {
  const allow = new Set([
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://localhost:5173",
    "https://adtell-react-app.vercel.app",
    ...(app.config.APP_ORIGIN ? [app.config.APP_ORIGIN] : []),
  ]);

  await app.register(cors, {
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    maxAge: 86400,
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      const ok = allow.has(origin) || VERCEL_RE.test(origin);
      return cb(null, ok);
    },
  });
});
