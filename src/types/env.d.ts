declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: "development" | "test" | "production";
    LOG_LEVEL?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
    PORT?: string;
    HOST?: string;
    TRUST_PROXY?: string;
    JWT_SECRET?: string;
    JWT_COOKIE?: string;
    APP_ORIGIN?: string;
    CORS_ORIGINS?: string;
    DATABASE_URL?: string;
    UPLOADS_DIR?: string;
    DEFAULT_FEED_URL?: string;
  }
}
