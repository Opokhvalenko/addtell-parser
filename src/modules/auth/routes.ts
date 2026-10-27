import type { FastifyPluginAsync } from "fastify";
import { authRateLimit } from "../../plugins/rate-limit.plugin.js";
import {
  type LoginBody,
  LoginBodySchema,
  type RegisterBody,
  RegisterBodySchema,
  SessionUserSchema,
} from "./schemas.js";
import {
  EmailTakenError,
  InvalidCredentialsError,
  loginUser,
  registerUser,
  warmUpLoginTiming,
} from "./service.js";
import {
  clearSessionCookies,
  endSession,
  REFRESH_COOKIE,
  rotateSession,
  type SessionUser,
  startSession,
} from "./session.js";

const routes: FastifyPluginAsync = async (app) => {
  await warmUpLoginTiming();
  const authLimit = authRateLimit(app);

  const readRefreshCookie = (raw: string | undefined): string | undefined => {
    if (!raw) return undefined;
    const { valid, value } = app.unsignCookie(raw);
    return valid && value ? value : undefined;
  };

  app.post<{ Body: RegisterBody }>(
    "/register",
    {
      config: { public: true, rateLimit: authLimit },
      schema: { body: RegisterBodySchema, response: { 201: SessionUserSchema } },
    },
    async (req, reply) => {
      try {
        const user = await registerUser(app, req.body.email, req.body.password);
        await startSession(app, reply, user);
        return reply.code(201).send(user);
      } catch (error) {
        if (error instanceof EmailTakenError) return reply.conflict(error.message);
        throw error;
      }
    },
  );

  app.post<{ Body: LoginBody }>(
    "/login",
    {
      config: { public: true, rateLimit: authLimit },
      schema: { body: LoginBodySchema, response: { 200: SessionUserSchema } },
    },
    async (req, reply) => {
      try {
        const user = await loginUser(app, req.body.email, req.body.password);
        await startSession(app, reply, user);
        return user;
      } catch (error) {
        if (error instanceof InvalidCredentialsError) return reply.unauthorized();
        throw error;
      }
    },
  );

  app.post(
    "/refresh",
    {
      config: { public: true, rateLimit: authLimit },
      schema: { response: { 200: SessionUserSchema } },
    },
    async (req, reply) => {
      const refreshToken = readRefreshCookie(req.cookies?.[REFRESH_COOKIE]);
      const user = refreshToken ? await rotateSession(app, reply, refreshToken) : null;
      if (!user) {
        clearSessionCookies(app, reply);
        return reply.unauthorized();
      }
      return user;
    },
  );

  app.get(
    "/me",
    { preHandler: app.authenticate, schema: { response: { 200: SessionUserSchema } } },
    async (req) => {
      const { id, email } = req.user as SessionUser;
      return { id, email };
    },
  );

  app.post("/logout", { config: { public: true } }, async (req, reply) => {
    await endSession(app, reply, readRefreshCookie(req.cookies?.[REFRESH_COOKIE]));
    return { ok: true };
  });
};

export default routes;
