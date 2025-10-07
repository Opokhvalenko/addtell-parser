import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import fp from "fastify-plugin";

export default fp(
  async (app) => {
    app.setErrorHandler(async (error, request, reply) => {
      request.log.error(
        {
          error: error.message,
          stack: error.stack,
          url: request.url,
          method: request.method,
          statusCode: error.statusCode,
          name: error.name,
        },
        "Unhandled error",
      );

      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        reply.code(409);
        return {
          error: "Email already registered",
          statusCode: 409,
        };
      }

      if (error.statusCode === 400 || error.validation) {
        reply.code(400);
        return {
          error: error.message,
          statusCode: 400,
        };
      }

      if (error.statusCode) {
        reply.code(error.statusCode);
        return {
          error: error.message,
          statusCode: error.statusCode,
        };
      }

      reply.code(500);
      return {
        error: "Internal Server Error",
        statusCode: 500,
      };
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
