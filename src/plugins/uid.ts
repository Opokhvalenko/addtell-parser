import fp from "fastify-plugin";
import { customAlphabet } from "nanoid";

const nano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 16);

declare module "fastify" {
  interface FastifyInstance {
    uid: () => string;
  }
}

export default fp(
  async (app) => {
    app.decorate("uid", () => nano());
  },
  { name: "uid" },
);
