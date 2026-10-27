import { promises as fs } from "node:fs";
import * as path from "node:path";
import schedule from "@fastify/schedule";
import fp from "fastify-plugin";
import { CronJob, Task } from "toad-scheduler";
import { configuredFeedSources } from "../modules/feed/sources.js";
import { withRetry } from "../utils/retry.js";
export default fp(async (app) => {
  const cronEnabled = String(app.config.CRON_ENABLE).toLowerCase() !== "false";
  if (!cronEnabled) {
    app.log.info("[feeds] scheduler disabled via CRON_ENABLE=false");
    return;
  }
  await app.register(schedule);
  const OUT = path.resolve(process.cwd(), app.config.FEEDS_OUT);
  const CRON = app.config.CRON_FEEDS_SCHEDULE;
  const TZ = app.config.CRON_TZ;
  const FEEDS_URL = app.config.FEEDS_URL || "";
  const parseSources = () => configuredFeedSources(app.config);
  async function writeOut(data: unknown) {
    await fs.mkdir(path.dirname(OUT), { recursive: true });
    await fs.writeFile(OUT, JSON.stringify(data, null, 2));
  }
  async function jobBody() {
    if (FEEDS_URL) {
      const data = await withRetry(
        async () => {
          const res = await fetch(FEEDS_URL, { redirect: "follow" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        },
        2,
        300,
      );
      await writeOut(data);
      app.log.info({ out: OUT }, "[feeds] written from FEEDS_URL");
      return;
    }
    const sources = parseSources();
    await writeOut({ sources, updatedAt: new Date().toISOString() });
    app.log.info({ out: OUT, count: sources.length }, "[feeds] sources manifest written");
  }
  const task = new Task("feeds-refresh", async () => {
    try {
      await jobBody();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      app.log.error({ error: errorMessage }, "[feeds] job failed");
    }
  });
  const job = new CronJob({ cronExpression: CRON, timezone: TZ }, task, { preventOverrun: true });
  app.scheduler.addCronJob(job);
  try {
    await jobBody();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    app.log.error({ error: errorMessage }, "[feeds] initial run failed");
  }
});
