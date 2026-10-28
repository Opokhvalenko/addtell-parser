import fp from "fastify-plugin";
import adserverRoutes from "../modules/adserver/routes.js";
import { ensureTtlIndex } from "../utils/mongo-ttl.js";

const HOUR_SECONDS = 3600;

export default fp(
  async (app) => {
    await app.register(adserverRoutes, { prefix: "/api" });

    // Every anonymous /api/bid stores an impression; only the frequency window is ever read
    app.addHook("onReady", async () => {
      try {
        await ensureTtlIndex(
          app,
          "Impression",
          "at",
          app.config.FREQUENCY_WINDOW_HOURS * HOUR_SECONDS,
        );
      } catch (err) {
        app.log.error({ err }, "adserver: could not ensure the impression TTL index");
      }
    });
    app.log.info("AdServer plugin registered");
  },
  {
    name: "adserver",
    // The multipart parser must exist before the form route is registered (otherwise 415)
    dependencies: ["multipart"],
  },
);
