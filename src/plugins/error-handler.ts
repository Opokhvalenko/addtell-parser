import type { FastifyError, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  const isProd = process.env.NODE_ENV === "production";

  fastify.setErrorHandler((err: FastifyError, req: FastifyRequest, reply: FastifyReply) => {
    const status = typeof err.statusCode === "number" ? err.statusCode : 500;
    const isClientErr = status >= 400 && status < 500;

    const log = isClientErr ? fastify.log.warn : fastify.log.error;
    log({ err, reqId: req.id, method: req.method, url: req.url }, "request errored");

    const body: Record<string, unknown> = {
      statusCode: status,
      error: err.name || "Error",
      message: err.message,
      requestId: req.id,
    };
    if (!isProd && err.stack) body.stack = err.stack;

    reply.status(status).send(body);
  });

  fastify.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Route not found",
      requestId: req.id,
    });
  });
};

export default fp(errorHandlerPlugin, { name: "error-handler" });
