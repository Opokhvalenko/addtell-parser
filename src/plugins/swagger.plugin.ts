import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import fp from "fastify-plugin";
export default fp(
  async (fastify) => {
    const isProd = fastify.config.NODE_ENV === "production";
    await fastify.register(swagger, {
      openapi: {
        info: {
          title: "AdTell API",
          version: "1.0.0",
          description: "AdTell - AdServer Platform API Documentation",
          contact: {
            name: "AdTell Team",
            email: "support@adtell.com",
          },
        },
        servers: [
          {
            url: "http://localhost:3000",
            description: "Development server",
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
    });
    if (!isProd) {
      await fastify.register(swaggerUI, {
        routePrefix: "/docs",
        uiConfig: { docExpansion: "list", deepLinking: true },
      });
    } else {
      await fastify.register(swaggerUI, {
        routePrefix: "/docs",
        staticCSP: true,
        transformStaticCSP: (header) => header,
      });
    }
    fastify.pluginLoaded?.("swagger");
  },
  { name: "swagger" },
);
