import fp from "fastify-plugin";

export default fp(
  async (app) => {
    const gracefulShutdown = async (signal: string) => {
      app.log.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        await app.close();
        app.log.info("Graceful shutdown completed");
        process.exit(0);
      } catch (error) {
        app.log.error({ error }, "Error during graceful shutdown");
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    app.log.info("Graceful shutdown plugin registered");
  },
  {
    name: "graceful-shutdown",
  },
);
