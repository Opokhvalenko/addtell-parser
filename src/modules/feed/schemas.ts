import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";

export const FeedQuerySchema = Type.Object(
  {
    url: Type.Optional(Type.String({ format: "uri" })),
    force: Type.Optional(Type.Literal("1")),
  },
  { additionalProperties: false },
);
export type FeedQuery = Static<typeof FeedQuerySchema>;

export const FeedItemSchema = Type.Object(
  {
    id: Type.String(),
    feedId: Type.String(),
    title: Type.String(),
    link: Type.String(),
    guid: Type.Optional(Type.String()),
    content: Type.Optional(Type.String()),
    pubDate: Type.String(),
    createdAt: Type.String(),
  },
  { additionalProperties: false },
);
export type FeedItemResponse = Static<typeof FeedItemSchema>;

export const FeedResponseSchema = Type.Object(
  {
    url: Type.String({ format: "uri" }),
    title: Type.Optional(Type.String()),
    items: Type.Array(FeedItemSchema),
  },
  { additionalProperties: false },
);
export type FeedResponse = Static<typeof FeedResponseSchema>;

export const ArticleQuerySchema = Type.Object(
  { url: Type.String({ format: "uri" }) },
  { additionalProperties: false },
);
export type ArticleQuery = Static<typeof ArticleQuerySchema>;

export const ArticleResponseSchema = Type.Object(
  {
    url: Type.String({ format: "uri" }),
    title: Type.String(),
    content: Type.String(),
  },
  { additionalProperties: false },
);
export type ArticleResponse = Static<typeof ArticleResponseSchema>;
