import { Type } from "@sinclair/typebox";
export const LineItemBody = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 200 }),
    sizes: Type.Array(Type.String({ pattern: "^[0-9]+x[0-9]+$" }), { minItems: 1 }),
    adType: Type.Union([Type.Literal("banner"), Type.Literal("video"), Type.Literal("native")]),
    geo: Type.Array(Type.String({ minLength: 2, maxLength: 8 }), { default: [] }),
    minCpm: Type.Optional(Type.Number({ minimum: 0 })),
    maxCpm: Type.Optional(Type.Number({ minimum: 0 })),
    frequencyPerDay: Type.Optional(Type.Integer({ minimum: 0 })),
    creativeId: Type.Optional(Type.String({ minLength: 1 })),
    clickUrl: Type.Optional(Type.String({ format: "uri" })),
    html: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
