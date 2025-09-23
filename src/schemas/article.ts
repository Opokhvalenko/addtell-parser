import type { FromSchema } from "json-schema-to-ts";

export const ArticleQuerySchema = {
  type: "object",
  required: ["url"],
  additionalProperties: false,
  properties: {
    url: { type: "string", format: "uri" },
  },
} as const;
export type ArticleQuery = FromSchema<typeof ArticleQuerySchema>;

export const ArticleResponseSchema = {
  type: "object",
  required: ["url", "title", "content"],
  additionalProperties: false,
  properties: {
    url: { type: "string", format: "uri" },
    title: { type: "string" },
    content: { type: "string" },
  },
} as const;
export type ArticleResponse = FromSchema<typeof ArticleResponseSchema>;
