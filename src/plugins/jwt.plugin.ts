import jwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: { id: string; email: string };
  }
}
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(
  async (app) => {
    await app.register(jwt, {
      secret: app.config.JWT_SECRET,
      cookie: {
        cookieName: "token",
        signed: false,
      },
    });

    app.decorate("authenticate", async (req, reply) => {
      try {
        await req.jwtVerify();
      } catch {
        return reply.unauthorized();
      }
    });

    app.addHook("onRequest", async (req) => {
      try {
        await req.jwtVerify();
      } catch {
        /* guest ok */
      }
    });
  },
  { name: "jwt", dependencies: ["cookie"] },
);
