import fastifyEnv from "@fastify/env";
import addFormats from "ajv-formats";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { EnvSchema } from "./schema.js";

export default fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(fastifyEnv, {
      confKey: "config",
      schema: EnvSchema,
      dotenv: true,
      data: process.env,
      ajv: {
        customOptions(ajv) {
          (
            addFormats as unknown as (
              a: typeof ajv,
              f?: string[] | Record<string, unknown>,
            ) => unknown
          )(ajv);

          ajv.opts.allErrors = true;
          ajv.opts.removeAdditional = "all";
          ajv.opts.coerceTypes = true;
          ajv.opts.useDefaults = true;
          return ajv;
        },
      },
    });

    fastify.decorate("pluginLoaded", (name: string) => {
      fastify.log.info(`✅ Plugin loaded: ${name}`);
    });
  },
  { name: "config-plugin" },
);
