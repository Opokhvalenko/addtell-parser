import { STATUS_CODES } from "node:http";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { FastifyError } from "fastify";
import fp from "fastify-plugin";

const BAD_REQUEST = 400;
const CONFLICT = 409;
const SERVER_ERROR = 500;

/**
 * Fastify passes anything that was thrown. Plugins also throw plain objects (the rate limiter
 * throws `{ statusCode: 429, … }`), so any object is read for these fields; anything else is a 500.
 */
function asFastifyError(error: unknown): Partial<FastifyError> {
  return typeof error === "object" && error !== null ? (error as Partial<FastifyError>) : {};
}

export default fp(
  async (app) => {
    app.setErrorHandler(async (error, request, reply) => {
      // Unique-constraint violations: a client conflict, but never say which value exists
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        request.log.warn({ code: error.code, url: request.url }, "Unique constraint violation");
        return reply.code(CONFLICT).send({ error: "Conflict", statusCode: CONFLICT });
      }

      const err = asFastifyError(error);
      const statusCode = err.validation
        ? BAD_REQUEST
        : err.statusCode && err.statusCode >= BAD_REQUEST
          ? err.statusCode
          : SERVER_ERROR;

      if (statusCode >= SERVER_ERROR) {
        // A route that answers 502/503/504 on purpose (an upstream failed) is not a bug here
        const deliberate = statusCode !== SERVER_ERROR;
        request.log[deliberate ? "warn" : "error"](
          { err: error, url: request.url, method: request.method },
          deliberate ? "Dependency error" : "Unhandled error",
        );
        // Only the status text: details (stack, upstream messages, hostnames) stay in the logs
        return reply
          .code(statusCode)
          .send({ error: STATUS_CODES[statusCode] ?? STATUS_CODES[SERVER_ERROR], statusCode });
      }

      request.log.warn({ statusCode, url: request.url, msg: err.message }, "Client error");
      return reply
        .code(statusCode)
        .send({ error: err.message ?? STATUS_CODES[statusCode], statusCode });
    });

    app.setNotFoundHandler(async (request, reply) => {
      reply.code(404);
      return {
        error: "Not Found",
        statusCode: 404,
        message: `Route ${request.method}:${request.url} not found`,
      };
    });

    app.log.info("Error handling plugin registered");
  },
  {
    name: "error-handling",
  },
);
