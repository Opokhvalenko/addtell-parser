import fs from "node:fs/promises";
import path from "node:path";
import schedule from "@fastify/schedule";
import retry from "async-retry";
import fp from "fastify-plugin";
import { AsyncTask, CronJob } from "toad-scheduler";

export default fp(async (app) => {
  const cronEnabled = String(process.env.CRON_ENABLE ?? "true").toLowerCase() !== "false";
  if (!cronEnabled) {
    app.log.info("[feeds] scheduler disabled via CRON_ENABLE=false");
    return;
  }

  await app.register(schedule);

  const OUT = path.resolve(process.cwd(), process.env.FEEDS_OUT ?? "public/ads/feeds.json");
  const CRON = process.env.CRON_FEEDS_SCHEDULE ?? "*/10 * * * *";
  const TZ = process.env.CRON_TZ ?? "UTC";

  const FEEDS_URL = process.env.FEEDS_URL || "";
  const FEEDS_SOURCES_RAW = process.env.FEEDS_SOURCES || "";
  const DEFAULT_FEED_URL = process.env.DEFAULT_FEED_URL || "";

  function parseSources(): string[] {
    if (FEEDS_SOURCES_RAW.trim().startsWith("[")) {
      try {
        const arr = JSON.parse(FEEDS_SOURCES_RAW);
        if (Array.isArray(arr)) return arr.map(String);
      } catch {}
    }
    return DEFAULT_FEED_URL ? [DEFAULT_FEED_URL] : [];
  }

  async function writeOut(data: unknown) {
    await fs.mkdir(path.dirname(OUT), { recursive: true });
    await fs.writeFile(OUT, JSON.stringify(data, null, 2));
  }

  async function jobBody() {
    if (FEEDS_URL) {
      const data = await retry(
        async (bail) => {
          const res = await fetch(FEEDS_URL, { redirect: "follow" });
          if (!res.ok && res.status < 500) bail(new Error(`HTTP ${res.status}`));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        },
        { retries: 2, factor: 2, minTimeout: 300, maxTimeout: 1500 },
      );

      await writeOut(data);
      app.log.info({ out: OUT }, "[feeds] written from FEEDS_URL");
      return;
    }

    const sources = parseSources();
    await writeOut({ sources, updatedAt: new Date().toISOString() });
    app.log.info({ out: OUT, count: sources.length }, "[feeds] sources manifest written");
  }

  const task = new AsyncTask("[feeds] job", jobBody, (err) => {
    app.log.error({ err }, "[feeds] job failed");
  });
  const job = new CronJob({ cronExpression: CRON, timezone: TZ }, task, { preventOverrun: true });

  app.addHook("onReady", async () => app.scheduler.addCronJob(job));

  try {
    await jobBody();
  } catch (err) {
    app.log.error({ err }, "[feeds] initial run failed");
  }
});
