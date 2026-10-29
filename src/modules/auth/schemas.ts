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
/**
 * An empty JSON object, required: a form on another site can POST `text/plain` or no body at
 * all, but not `application/json` — without this, any page could sign its visitors into the
 * demo account (login CSRF).
 */
export const DemoBodySchema = Type.Object({}, { additionalProperties: false });

/** Tokens live only in httpOnly cookies — never in a response body JavaScript could read. */
export const SessionUserSchema = Type.Object(
  {
    id: Type.String(),
    email: Type.String({ format: "email" }),
  },
  { additionalProperties: false },
);
