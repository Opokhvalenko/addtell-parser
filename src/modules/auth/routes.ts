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

type CfgExtra = { COOKIE_SECURE?: "true" | "false"; APP_ORIGIN?: string };

const routes: FastifyPluginAsync = async (app) => {
  const cfg = app.config as typeof app.config & CfgExtra;

  const isProd = cfg.NODE_ENV === "production";
  const secure = isProd && cfg.COOKIE_SECURE !== "false";
  const sameSite: "lax" | "none" =
    isProd && !(cfg.APP_ORIGIN ?? "").includes("localhost") ? "none" : "lax";

  const cookieOpts = {
    httpOnly: true,
    sameSite,
    path: "/",
    secure,
    maxAge: 60 * 60 * 24 * 30,
  } as const;

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
    reply.clearCookie("token", { path: "/", sameSite, secure });
    return { ok: true };
  });
};

export default routes;
