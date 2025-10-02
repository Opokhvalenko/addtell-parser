import type { FromSchema } from "json-schema-to-ts";

export const OkSchema = {
  type: "object",
  properties: { status: { type: "string", const: "ok" } },
  required: ["status"],
  additionalProperties: false,
} as const;

export type Ok = FromSchema<typeof OkSchema>;
