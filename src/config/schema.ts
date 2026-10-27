import type { FromSchema } from "json-schema-to-ts";
export const EnvSchema = {
  $id: "EnvSchema",
  type: "object",
  $defs: { url: { type: "string", format: "uri" } },
  properties: {
    PORT: { type: "integer", minimum: 1, maximum: 65535, default: 3000 },
    HOST: { type: "string", default: "0.0.0.0" },
    FRAME_ANCESTORS: { type: "string" },
    PUBLIC_URL: { $ref: "#/$defs/url", default: "http://localhost:3000" },
    SWAGGER_ENABLE: { type: "string" },
    SWAGGER_UI: { type: "string" },

    UPLOADS_DIR: { type: "string", default: "./uploads" },
    DATABASE_URL: { $ref: "#/$defs/url" },
    DEFAULT_FEED_URL: { $ref: "#/$defs/url", default: "https://example.com/feed" },
    JWT_SECRET: { type: "string", minLength: 32 },
    JWT_COOKIE: { type: "string", default: "token" },
    COOKIE_SECRET: { type: "string", minLength: 32 },
    /** No default: cookies are Secure in production unless explicitly "false". */
    COOKIE_SECURE: { type: "string", enum: ["true", "false"] },
    APP_ORIGIN: { $ref: "#/$defs/url" },
    /** Extra allowed origins, comma-separated (exact values, no wildcards). */
    CORS_ORIGINS: { type: "string" },
    NODE_ENV: {
      type: "string",
      enum: ["development", "test", "production"],
      default: "development",
    },
    LOG_LEVEL: {
      type: "string",
      enum: ["fatal", "error", "warn", "info", "debug", "trace", "silent"],
      default: "info",
    },

    CLICKHOUSE_ENABLE: { type: "string", default: "true" },
    CLICKHOUSE_SKIP_DDL: { type: "string", default: "true" },
    CLICKHOUSE_URL: { type: "string", default: "http://127.0.0.1:8123" },
    CLICKHOUSE_DB: { type: "string", default: "mydb" },
    CLICKHOUSE_USER: { type: "string", default: "default" },
    CLICKHOUSE_PASSWORD: { type: "string", default: "" },
    CLICKHOUSE_TABLE: { type: "string", default: "events" },
    CLICKHOUSE_CONNECT_TIMEOUT_MS: { type: "integer", default: 3000 },
    CLICKHOUSE_PING_TIMEOUT_MS: { type: "integer", default: 2000 },

    CH_BATCH_SIZE: { type: "integer", default: 1000 },
    CH_FLUSH_MS: { type: "integer", default: 5000 },

    CRON_ENABLE: { type: "string", default: "true" },
    FEEDS_OUT: { type: "string", default: "public/ads/feeds.json" },
    CRON_FEEDS_SCHEDULE: { type: "string", default: "*/10 * * * *" },
    CRON_TZ: { type: "string", default: "UTC" },
    FEEDS_URL: { type: "string" },
    FEEDS_SOURCES: { type: "string" },
    FREQUENCY_WINDOW_HOURS: { type: "integer", default: 24 },
    RATE_LIMIT_MAX: { type: "integer", minimum: 1 },
    RATE_LIMIT_WINDOW: { type: "string" },
    AUTH_RATE_LIMIT_MAX: { type: "integer", minimum: 1 },
    TRUST_PROXY_HOPS: { type: "integer", minimum: 0 },
  },
  required: ["DATABASE_URL", "JWT_SECRET", "COOKIE_SECRET"],
  additionalProperties: false,
} as const;
export type Config = FromSchema<typeof EnvSchema>;
