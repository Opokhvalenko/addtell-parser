import type { FromSchema } from "json-schema-to-ts";

export const EnvSchema = {
  $id: "EnvSchema",
  type: "object",
  $defs: {
    url: {
      type: "string",
      format: "uri",
    },
  },
  properties: {
    PORT: { type: "integer", minimum: 1, maximum: 65535 },
    HOST: { type: "string" },
    DATABASE_URL: { $ref: "#/$defs/url" },
    DEFAULT_FEED_URL: { $ref: "#/$defs/url" },
  },
  required: ["PORT", "HOST", "DATABASE_URL"],
  additionalProperties: false,
} as const;

export type Config = FromSchema<typeof EnvSchema>;
