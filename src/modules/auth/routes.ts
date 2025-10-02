import type { FastifyPluginAsync } from "fastify";
import {
  AuthResponseSchema,
  type LoginBody,
  LoginBodySchema,
  MeResponseSchema,
  type RegisterBody,
  RegisterBodySchema,
} from "./schemas.js";
import { loginUser, registerUser } from "./service.js";

const routes: FastifyPluginAsync = async (app) => {
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: app.config.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  };

  app.post<{ Body: RegisterBody }>(
    "/auth/register",
    { schema: { body: RegisterBodySchema, response: { 201: AuthResponseSchema } } },
    async (req, reply) => {
      const u = await registerUser(app, req.body.email, req.body.password);
      const token = await reply.jwtSign({ id: u.id, email: u.email });
      reply.setCookie("token", token, cookieOpts).code(201);
      return { token };
    },
  );

  app.post<{ Body: LoginBody }>(
    "/auth/login",
    { schema: { body: LoginBodySchema, response: { 200: AuthResponseSchema } } },
    async (req, reply) => {
      const { token } = await loginUser(app, req.body.email, req.body.password);
      reply.setCookie("token", token, cookieOpts);
      return { token };
    },
  );

  app.get(
    "/auth/me",
    { preHandler: app.authenticate, schema: { response: { 200: MeResponseSchema } } },
    async (req) => req.user,
  );

  app.post("/auth/logout", async (_req, reply) => {
    reply.clearCookie("token", { path: "/" });
    return { ok: true };
  });
};

export default routes;
