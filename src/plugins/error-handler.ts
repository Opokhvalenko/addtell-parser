import type { FastifyError, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const plugin: FastifyPluginAsync = async (fastify) => {
  const isProd = process.env.NODE_ENV === "production";

  fastify.setErrorHandler(
    (err: FastifyError & { code?: string; validation?: unknown }, req, reply) => {
      const status = typeof err.statusCode === "number" ? err.statusCode : 500;
      const isClientErr = status >= 400 && status < 500;
      const isValidation = err.code === "FST_ERR_VALIDATION" || !!err.validation;

      if (isClientErr) {
        req.log.warn({ err, reqId: req.id, method: req.method, url: req.url }, "request errored");
      } else {
        req.log.error({ err, reqId: req.id, method: req.method, url: req.url }, "request errored");
      }

      const body: Record<string, unknown> = {
        statusCode: status,
        error: isValidation ? "BadRequestError" : err.name || "Error",
        message: isClientErr ? err.message : isProd ? "Internal Server Error" : err.message,
        requestId: req.id,
      };

      if (!isProd) {
        if (isValidation && err.validation) body.issues = err.validation;
        else if (err.stack) body.stack = err.stack;
      }

      reply.code(status).send(body);
    },
  );

  fastify.setNotFoundHandler((req, reply) => {
    reply.code(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Route not found",
      requestId: req.id,
    });
  });
};

export default fp(plugin, { name: "error-handler" });
