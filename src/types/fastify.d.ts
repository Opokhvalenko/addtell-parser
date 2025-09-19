import { Config } from "../config/schema";

declare module "fastify" {
  interface FastifyInstance {
    config: Config;
    pluginLoaded: (pluginName: string) => void;
  }
}
