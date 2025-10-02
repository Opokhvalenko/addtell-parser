import type { FromSchema } from "json-schema-to-ts";

export const EnvSchema = {
  $id: "EnvSchema",
  type: "object",
  $defs: { url: { type: "string", format: "uri" } },
  properties: {
    PORT: { type: "integer", minimum: 1, maximum: 65535, default: 3000 },
    HOST: { type: "string", default: "0.0.0.0" },

    UPLOADS_DIR: { type: "string", default: "./uploads" },

    DATABASE_URL: { $ref: "#/$defs/url" },

    DEFAULT_FEED_URL: { $ref: "#/$defs/url", default: "https://hnrss.org/frontpage" },

    JWT_SECRET: { type: "string", minLength: 32 },
    ADMIN_TOKEN: { type: "string" },
    COOKIE_SECRET: { type: "string" },

    APP_ORIGIN: { $ref: "#/$defs/url" },
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
  },
  required: ["DATABASE_URL", "JWT_SECRET"],
  additionalProperties: false,
} as const;

export type Config = FromSchema<typeof EnvSchema>;
