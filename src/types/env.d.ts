declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: "development" | "test" | "production";
    LOG_LEVEL?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
    PORT?: string;
    HOST?: string;
    TRUST_PROXY?: string;

    JWT_SECRET?: string;
    COOKIE_SECRET?: string;
    COOKIE_SECURE?: "true" | "false";

    APP_ORIGIN?: string;
    CORS_ORIGINS?: string;
    ADMIN_TOKEN?: string;

    // ClickHouse
    CLICKHOUSE_URL?: string;
    CLICKHOUSE_DB?: string;
    CLICKHOUSE_USER?: string;
    CLICKHOUSE_PASSWORD?: string;
    CLICKHOUSE_TABLE?: string;

    // Ingest settings
    CH_BATCH_SIZE?: string;
    CH_FLUSH_MS?: string;

    // App data
    DATABASE_URL?: string;
    UPLOADS_DIR?: string;
    DEFAULT_FEED_URL?: string;
  }
}
