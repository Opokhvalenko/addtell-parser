import swagger from "@fastify/swagger";
import swaggerUi, { type FastifySwaggerUiOptions } from "@fastify/swagger-ui";
import fp from "fastify-plugin";

function isTrue(v: unknown) {
  return String(v).toLowerCase() === "true";
}

function withServers(s: Readonly<Record<string, unknown>>, url: string): Record<string, unknown> {
  return { ...s, servers: [{ url }] };
}

export default fp(
  async (app) => {
    const cfg = app.config;
    const isProd = (cfg?.NODE_ENV ?? process.env.NODE_ENV) === "production";

    const swaggerEnabled = isTrue(cfg?.SWAGGER_ENABLE ?? (!isProd && "true"));
    const uiEnabled = isTrue(cfg?.SWAGGER_UI ?? (!isProd && "true"));

    if (!swaggerEnabled) {
      app.log.info("Swagger disabled");
      return;
    }

    const appVersion = process.env.npm_package_version ?? "1.0.0";
    const baseUrl = cfg?.APP_ORIGIN ?? cfg?.PUBLIC_URL ?? "/";

    await app.register(swagger, {
      openapi: {
        openapi: "3.0.0",
        info: {
          title: "AdTell API",
          version: appVersion,
          description: "AdTell - AdServer Platform API Documentation",
          contact: { name: "AdTell Team", email: "support@adtell.com" },
        },
        servers: [{ url: baseUrl, description: "Server" }],
        components: {
          securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
          },
        },
        security: [{ bearerAuth: [] }],
      },
      hideUntagged: true,
    });

    app.after(() => {
      if (!uiEnabled) return;

      const uiOpts: FastifySwaggerUiOptions = {
        routePrefix: "/docs",
        uiConfig: { docExpansion: "list", deepLinking: true },
        transformSpecificationClone: true,
        transformSpecification: (spec, req, _reply) => {
          const host = (req.headers["x-forwarded-host"] as string) ?? req.hostname;
          const proto = (req.headers["x-forwarded-proto"] as string) ?? req.protocol;
          const url = `${proto}://${host}`;
          return withServers(spec as Readonly<Record<string, unknown>>, url);
        },
      };

      if (isProd) uiOpts.staticCSP = true;

      app.register(swaggerUi, uiOpts);
    });

    app.log.info("Swagger plugin registered");
  },
  { name: "swagger" },
);
