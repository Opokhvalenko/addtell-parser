import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { initializeTelemetry, shutdownTelemetry } from "./telemetry/index.js";

initializeTelemetry();

async function start(): Promise<void> {
  const app: FastifyInstance = await buildApp();
  const port = Number(app.config.PORT ?? 3000);
  const host = app.config.HOST ?? "0.0.0.0";
  try {
    const address = await app.listen({ port, host });
    app.log.info({ address }, "server started");
  } catch (err) {
    app.log.error(err, "failed to start server");
    process.exit(1);
  }
  const close = async (sig: string) => {
    try {
      app.log.info({ sig }, "shutting down");
      await shutdownTelemetry();
      await app.close();
      process.exit(0);
    } catch (e) {
      app.log.error(e, "error during shutdown");
      process.exit(1);
    }
  };
  process.on("SIGINT", () => close("SIGINT"));
  process.on("SIGTERM", () => close("SIGTERM"));
}
void start();
