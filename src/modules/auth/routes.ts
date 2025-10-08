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

type CfgExtra = { COOKIE_SECURE?: "true" | "false"; APP_ORIGIN?: string; NODE_ENV?: string };

const routes: FastifyPluginAsync = async (app) => {
  const cfg = app.config as typeof app.config & CfgExtra;

  const isProd = cfg.NODE_ENV === "production";
  const crossSite = isProd && !(cfg.APP_ORIGIN ?? "").includes("localhost");

  const cookieOpts = {
    httpOnly: true,
    sameSite: (crossSite ? "none" : "lax") as "none" | "lax",
    path: "/",
    secure: crossSite || cfg.COOKIE_SECURE === "true",
    signed: true,
    maxAge: 60 * 60 * 24 * 30,
  } as const;

  app.post<{ Body: RegisterBody }>(
    "/auth/register",
    {
      config: { public: true },
      schema: { body: RegisterBodySchema, response: { 201: AuthResponseSchema } },
    },
    async (req, reply) => {
      try {
        const u = await registerUser(app, req.body.email, req.body.password);
        const token = await reply.jwtSign({ id: u.id, email: u.email });
        reply.setCookie("token", token, cookieOpts).code(201);
        return { token };
      } catch (error) {
        if (error instanceof Error && error.message === "Email already registered") {
          reply.code(409);
          return { error: "Email already registered", statusCode: 409 };
        }
        req.log.error({ err: error }, "register failed");
        return reply.internalServerError();
      }
    },
  );

  app.post<{ Body: LoginBody }>(
    "/auth/login",
    {
      config: { public: true },
      schema: { body: LoginBodySchema, response: { 200: AuthResponseSchema } },
    },
    async (req, reply) => {
      try {
        const { token } = await loginUser(app, req.body.email, req.body.password);
        reply.setCookie("token", token, cookieOpts);
        return { token };
      } catch (error) {
        req.log.warn({ err: error }, "login failed");
        return reply.unauthorized();
      }
    },
  );

  app.get(
    "/auth/me",
    { preHandler: app.authenticate, schema: { response: { 200: MeResponseSchema } } },
    async (req) => {
      const token = await req.server.jwt.sign({ id: req.user.id, email: req.user.email });
      return { id: req.user.id, email: req.user.email, token };
    },
  );

  app.post("/auth/logout", { config: { public: true } }, async (_req, reply) => {
    reply.clearCookie("token", {
      path: "/",
      sameSite: cookieOpts.sameSite,
      secure: cookieOpts.secure,
      signed: true,
    });
    return { ok: true };
  });
};

export default routes;
