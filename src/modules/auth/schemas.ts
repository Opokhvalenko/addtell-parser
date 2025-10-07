import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
export const RegisterBodySchema = Type.Object(
  {
    email: Type.String({ format: "email", maxLength: 320 }),
    password: Type.String({ minLength: 8, maxLength: 128 }),
  },
  { additionalProperties: false },
);
export type RegisterBody = Static<typeof RegisterBodySchema>;
export const LoginBodySchema = RegisterBodySchema;
export type LoginBody = Static<typeof LoginBodySchema>;
export const AuthResponseSchema = Type.Object(
  { token: Type.String() },
  { additionalProperties: false },
);
export const MeResponseSchema = Type.Object(
  {
    id: Type.String(),
    email: Type.String({ format: "email" }),
    token: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);
