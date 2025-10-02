import fastifyEnv from "@fastify/env";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { ajvFormatsPlugin } from "../lib/ajvFormatsPlugin.js";
import { EnvSchema } from "./schema.js";

const configPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyEnv, {
    confKey: "config",
    schema: EnvSchema,
    dotenv: true,
    data: process.env,
    ajv: {
      customOptions(ajv) {
        ajvFormatsPlugin(ajv as unknown as Record<string, unknown>);

        ajv.opts.allErrors = true;
        ajv.opts.coerceTypes = true;
        ajv.opts.removeAdditional = "all";
        ajv.opts.useDefaults = true;
        return ajv;
      },
    },
  });
};

export default fp(configPlugin, { name: "config-plugin" });
