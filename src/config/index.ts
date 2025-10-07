import fastifyEnv from "@fastify/env";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import type { AjvLike } from "../plugins/ajv-formats.plugin.js";
import { ajvFormatsPlugin } from "../plugins/ajv-formats.plugin.js";

import type { Config } from "./schema.js";
import { EnvSchema } from "./schema.js";

declare module "fastify" {
  interface FastifyInstance {
    config: Config;
  }
}

const configPlugin: FastifyPluginAsync = async (app) => {
  if (app.hasDecorator("config")) {
    app.log.warn("config already decorated, skipping @fastify/env");
    return;
  }

  await app.register(fastifyEnv, {
    confKey: "config",
    schema: EnvSchema,
    dotenv: true,
    data: process.env,
    ajv: {
      customOptions(ajv: AjvLike) {
        ajvFormatsPlugin(ajv);
        ajv.opts.allErrors = true;
        ajv.opts.coerceTypes = true;
        ajv.opts.useDefaults = true;
        ajv.opts.removeAdditional = "all";
        return ajv;
      },
    },
  });
};

export default fp(configPlugin, { name: "config-plugin" });
