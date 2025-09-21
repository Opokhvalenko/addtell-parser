import Sensible from "@fastify/sensible";
import fp from "fastify-plugin";

export default fp(
  async (fastify) => {
    await fastify.register(Sensible);
  },
  { name: "sensible" },
);
