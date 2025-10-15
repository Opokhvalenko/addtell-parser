import swagger from "@fastify/swagger";
import swaggerUI, { type FastifySwaggerUiOptions } from "@fastify/swagger-ui";
import fp from "fastify-plugin";

export default fp(
  async (app) => {
    const isProd = String(app.config.NODE_ENV).toLowerCase() === "production";
    const enable =
      String(app.config.SWAGGER_ENABLE ?? (isProd ? "false" : "true")).toLowerCase() !== "false";
    const showUI =
      String(app.config.SWAGGER_UI ?? (isProd ? "false" : "true")).toLowerCase() !== "false";

    if (!enable) return;

    await app.register(swagger, {
      openapi: {
        info: {
          title: "AdTell API",
          version: "1.0.0",
          description: "AdTell - AdServer Platform API Documentation",
          contact: { name: "AdTell Team", email: "support@adtell.com" },
        },
        servers: [{ url: app.config.PUBLIC_URL ?? "http://localhost:3000" }],
        components: {
          securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
        },
        security: [{ bearerAuth: [] }],
      },
    });

    if (showUI) {
      const uiOpts: FastifySwaggerUiOptions = {
        routePrefix: "/docs",
        uiConfig: { docExpansion: "list", deepLinking: true },
        ...(isProd ? { staticCSP: true, transformStaticCSP: (h: string) => h } : {}),
      };

      await app.register(swaggerUI, uiOpts);
    }

    app.addHook("onReady", () => {
      try {
        app.swagger();
      } catch (err) {
        app.log.warn({ err }, "[swagger] build failed");
      }
    });
  },
  { name: "swagger" },
);
