import type { FromSchema } from "json-schema-to-ts";

export const EnvSchema = {
  $id: "EnvSchema",
  type: "object",
  $defs: {
    url: { type: "string", format: "uri" },
    nonEmpty: { type: "string", minLength: 1 },
  },
  properties: {
    // Server
    PORT: { type: "integer", minimum: 1, maximum: 65535 },
    HOST: { type: "string" },

    // Database
    DATABASE_URL: { $ref: "#/$defs/url" },

    // Features
    DEFAULT_FEED_URL: { $ref: "#/$defs/url" },

    // Auth
    JWT_SECRET: { type: "string", minLength: 32 },

    // Optional quality-of-life vars
    NODE_ENV: { type: "string", enum: ["development", "test", "production"] },
    LOG_LEVEL: {
      type: "string",
      enum: ["fatal", "error", "warn", "info", "debug", "trace", "silent"],
    },
  },
  required: ["PORT", "HOST", "DATABASE_URL", "JWT_SECRET"],
  additionalProperties: false,
} as const;

export type Config = FromSchema<typeof EnvSchema>;
