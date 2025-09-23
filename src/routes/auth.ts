import type { FastifyPluginAsync } from "fastify";
import type { JwtPayload } from "../plugins/jwt.js";
import {
  AuthResponseSchema,
  type LoginBody,
  LoginBodySchema,
  MeResponseSchema,
  type RegisterBody,
  RegisterBodySchema,
} from "../schemas/auth.js";
import { loginUser, registerUser } from "../services/authService.js";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/auth/register",
    {
      schema: {
        body: RegisterBodySchema,
        response: {
          201: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              email: { type: "string", format: "email" },
              createdAt: { type: "string" },
            },
            required: ["id", "email", "createdAt"],
          } as const,
        },
      },
    },
    async (req, reply) => {
      const { email, password } = req.body as RegisterBody;
      const user = await registerUser(fastify, email, password);
      reply.code(201);
      return user;
    },
  );

  fastify.post(
    "/auth/login",
    {
      schema: {
        body: LoginBodySchema,
        response: { 200: AuthResponseSchema },
      },
    },
    async (req) => {
      const { email, password } = req.body as LoginBody;
      const { token } = await loginUser(fastify, email, password);
      return { token };
    },
  );

  fastify.get<{ Reply: JwtPayload }>(
    "/auth/me",
    {
      preHandler: fastify.authenticate,
      schema: {
        response: { 200: MeResponseSchema },
      },
    },
    async (req) => req.user as JwtPayload,
  );
};

export default authRoutes;
