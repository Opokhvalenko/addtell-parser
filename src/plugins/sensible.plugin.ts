import sensible from "@fastify/sensible";
import fp from "fastify-plugin";

export default fp(async (app) => {
  await app.register(sensible);
});
