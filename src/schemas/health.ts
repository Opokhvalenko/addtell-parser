import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";

export const OkSchema = Type.Object(
  { status: Type.Literal("ok") },
  { additionalProperties: false },
);

export type Ok = Static<typeof OkSchema>;
