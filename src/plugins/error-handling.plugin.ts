import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import fp from "fastify-plugin";

const BAD_REQUEST = 400;
const CONFLICT = 409;
const SERVER_ERROR = 500;

export default fp(
  async (app) => {
    app.setErrorHandler(async (error, request, reply) => {
      // Unique-constraint violations: a client conflict, but never say which value exists
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        request.log.warn({ code: error.code, url: request.url }, "Unique constraint violation");
        return reply.code(CONFLICT).send({ error: "Conflict", statusCode: CONFLICT });
      }

      const statusCode = error.validation
        ? BAD_REQUEST
        : error.statusCode && error.statusCode >= BAD_REQUEST
          ? error.statusCode
          : SERVER_ERROR;

      if (statusCode >= SERVER_ERROR) {
        request.log.error(
          { err: error, url: request.url, method: request.method },
          "Unhandled error",
        );
        // Internal details (stack, upstream messages, hostnames) stay in the logs
        return reply.code(statusCode).send({ error: "Internal Server Error", statusCode });
      }

      request.log.warn({ statusCode, url: request.url, msg: error.message }, "Client error");
      return reply.code(statusCode).send({ error: error.message, statusCode });
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
