import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import fp from "fastify-plugin";

export default fp(
  async (fastify) => {
    const isProd =
      fastify?.config?.NODE_ENV === "production" || process.env.NODE_ENV === "production";

    await fastify.register(swagger, {
      openapi: {
        info: { title: "Feed API", version: "1.0.0" },
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
