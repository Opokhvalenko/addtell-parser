//src/schemas/auth.ts
import type { FromSchema } from "json-schema-to-ts";

export const RegisterBodySchema = {
  type: "object",
  required: ["email", "password"],
  additionalProperties: false,
  properties: {
    email: { type: "string", format: "email", maxLength: 320 },
    password: { type: "string", minLength: 8, maxLength: 128 },
  },
} as const;
export type RegisterBody = FromSchema<typeof RegisterBodySchema>;

export const LoginBodySchema = RegisterBodySchema;
export type LoginBody = FromSchema<typeof LoginBodySchema>;

export const AuthResponseSchema = {
  type: "object",
  required: ["token"],
  additionalProperties: false,
  properties: {
    token: { type: "string" },
  },
} as const;
export type AuthResponse = FromSchema<typeof AuthResponseSchema>;

export const MeResponseSchema = {
  type: "object",
  required: ["id", "email"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    email: { type: "string", format: "email" },
  },
} as const;
export type MeResponse = FromSchema<typeof MeResponseSchema>;
