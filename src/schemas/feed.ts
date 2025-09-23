//src/schemas/feed.ts
import type { FromSchema } from "json-schema-to-ts";

export const QuerySchema = {
  type: "object",
  properties: {
    url: { type: "string", format: "uri" },
    force: { type: "string", enum: ["1"] },
  },
  additionalProperties: false,
} as const;
export type Query = FromSchema<typeof QuerySchema>;

export const FeedItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "feedId", "title", "link", "pubDate", "createdAt"],
  properties: {
    id: { type: "string" },
    feedId: { type: "string" },
    title: { type: "string" },
    link: { type: "string" },
    guid: { type: "string" },
    content: { type: "string" },
    pubDate: { type: "string" },
    createdAt: { type: "string" },
  },
} as const;
export type FeedItemResponse = FromSchema<typeof FeedItemSchema>;

export const FeedResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["url", "items"],
  properties: {
    url: { type: "string", format: "uri" },
    title: { type: "string" },
    items: { type: "array", items: FeedItemSchema },
  },
} as const;
export type FeedResponse = FromSchema<typeof FeedResponseSchema>;
