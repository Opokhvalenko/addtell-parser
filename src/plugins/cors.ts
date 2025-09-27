import cors from "@fastify/cors";
import fp from "fastify-plugin";

const VERCEL_RE = /^https:\/\/(?:[a-z0-9-]+\.)?vercel\.app$/i;

export default fp(async (app) => {
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allow = new Set([
        "http://localhost:5173",
        "http://localhost:3000",
        "https://adtell-react-app.vercel.app",
      ]);
      const ok = allow.has(origin) || VERCEL_RE.test(origin);
      cb(ok ? null : new Error("CORS not allowed"), ok);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-admin-token"],
    maxAge: 86400,
  });
});
