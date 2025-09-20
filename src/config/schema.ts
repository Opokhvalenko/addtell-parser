import type { FromSchema } from "json-schema-to-ts";

export const EnvSchema = {
  type: "object",
  properties: {
    PORT: { type: "number" },
    HOST: { type: "string" },
    DATABASE_URL: { type: "string" },
    DEFAULT_FEED_URL: { type: "string" }, 
  },
  required: ["PORT", "HOST", "DATABASE_URL"],
  additionalProperties: false,
} as const;

export type Config = FromSchema<typeof EnvSchema>;