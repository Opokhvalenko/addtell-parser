import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import fp from "fastify-plugin";

export default fp(
  async (app) => {
    const isProd = String(app.config.NODE_ENV).toLowerCase() === "production";
    const enable =
      String(app.config.SWAGGER_ENABLE ?? (isProd ? "false" : "true")).toLowerCase() !== "false";
    if (!enable) {
      app.log.warn("[swagger] disabled (SWAGGER_ENABLE=false)");
      return;
    }

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

    // UI: у prod за замовчуванням вимкнено (аби не блокувати старт)
    if (!isProd) {
      await app.register(swaggerUI, {
        routePrefix: "/docs",
        uiConfig: { docExpansion: "list", deepLinking: true },
      });
    }

    // Будуємо spec після повного завантаження всіх плагінів — без дедлоку
    app.addHook("onReady", () => {
      try {
        app.swagger();
      } catch (err) {
        app.log.warn({ err }, "[swagger] build failed");
      }
    });

    app.log.info("Swagger plugin registered");
  },
  { name: "swagger" },
);
