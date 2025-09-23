import fastifyJwt from "@fastify/jwt";
import fp from "fastify-plugin";

export type JwtPayload = { id: string; email: string };

declare module "fastify" {
  interface FastifyInstance {
    authenticate: import("fastify").preHandlerHookHandler;
  }
}

export default fp(
  async (fastify) => {
    fastify.register(fastifyJwt, { secret: fastify.config.JWT_SECRET });

    fastify.decorate("authenticate", async (req, reply) => {
      try {
        await req.jwtVerify<JwtPayload>();
      } catch {
        return reply.unauthorized();
      }
    });
  },
  { name: "jwt" },
);
