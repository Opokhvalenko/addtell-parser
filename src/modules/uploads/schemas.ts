import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";

export const UploadResponseSchema = Type.Object(
  {
    url: Type.String(),
    filename: Type.String(),
    mime: Type.String(),
    creativeId: Type.String(),
  },
  { additionalProperties: false },
);

export type UploadResponse = Static<typeof UploadResponseSchema>;
