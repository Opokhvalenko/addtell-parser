import cors from "@fastify/cors";
import fp from "fastify-plugin";

/** Local frontends during development; production uses only origins from the environment. */
const DEV_ORIGINS = ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"];

/**
 * Exact origin allowlist. Never a wildcard or a pattern over a shared domain such as
 * `*.vercel.app`: anyone can host a page there, and with `credentials: true` it would act as the
 * logged-in user. In production the frontend calls the API through its own domain (Vercel
 * rewrite), so browsers do not need CORS at all.
 */
export function allowedOrigins(config: {
  NODE_ENV?: string;
  APP_ORIGIN?: string;
  CORS_ORIGINS?: string;
}): Set<string> {
  const fromEnv = (config.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([
    ...(config.NODE_ENV === "production" ? [] : DEV_ORIGINS),
    ...(config.APP_ORIGIN ? [config.APP_ORIGIN] : []),
    ...fromEnv,
  ]);
}

export default fp(async (app) => {
  const allow = allowedOrigins(app.config);
  await app.register(cors, {
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    maxAge: 86400,
    origin(origin, cb) {
      cb(null, !origin || allow.has(origin));
    },
  });
});
