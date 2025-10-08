import fp from "fastify-plugin";
import client from "prom-client";

declare module "fastify" {
  interface FastifyInstance {
    metrics?: {
      register: client.Registry;
      ingestCounter: client.Counter<string>;
    };
  }
}
export default fp(
  async (app) => {
    if (app.metrics) return;
    const register = new client.Registry();
    client.collectDefaultMetrics({ register });
    const ingestCounter = new client.Counter({
      name: "ingest_events_total",
      help: "Total ingested events",
      registers: [register],
      labelNames: ["source"],
    });
    app.decorate("metrics", { register, ingestCounter });
    app.get("/metrics", async (_req, reply) => {
      return reply.type(register.contentType).send(await register.metrics());
    });
  },
  { name: "prom.plugin" },
);
