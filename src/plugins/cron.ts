import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import cron from "node-cron";
import { runFeedsCycle } from "../cron/runner.js";
import { createCronState } from "../cron/state.js";
import type { CronConfig } from "../cron/types.js";
import { parseList } from "../lib/parseList.js";

async function plugin(app: FastifyInstance) {
  const enable = (process.env.CRON_ENABLE ?? "true").toLowerCase() !== "false";
  if (!enable) {
    app.log.info("[cron] disabled");
    return;
  }

  const cfg: CronConfig = {
    schedule: process.env.CRON_FEEDS_SCHEDULE ?? "*/10 * * * *",
    timezone: process.env.CRON_TZ ?? "UTC",
    outPath: (process.env.FEEDS_OUT ?? "public/ads/feeds.json").replace(
      /^~\//,
      `${process.cwd()}/`,
    ),
    take: Number(process.env.FEEDS_TAKE ?? 20),
    historyLimit: Number(process.env.CRON_HISTORY ?? 24),
    sources: parseList(process.env.FEEDS_SOURCES) || parseList(process.env.FEEDS_URL),
  };

  if (!cfg.sources.length) {
    app.log.warn("[cron] FEEDS_SOURCES/FEEDS_URL is empty — nothing to do");
    return;
  }

  const state = createCronState(cfg);

  // статус віддаємо іншим модулям
  app.decorate("cronFeedsStatus", () => state.status());

  // запуск циклу
  app.decorate("cronFeedsRun", async (onlyUrl?: string) => {
    if (state.isRunning()) {
      app.log.warn("[cron] run skipped: already running");
      return;
    }

    const t0 = Date.now();
    state.start();

    try {
      await runFeedsCycle({
        app,
        sources: onlyUrl ? [onlyUrl] : cfg.sources,
        outPath: cfg.outPath,
        take: cfg.take,
        markOk: () => state.markOk(),
        markFail: (err, url) => state.markFail(err, url),
      });
    } catch (err) {
      state.markFail(err as Error);
      app.log.error({ msg: (err as Error)?.message }, "[cron] cycle failed");
    } finally {
      state.finish(Date.now() - t0);
      const s = state.status();
      app.log.info(
        {
          ok: s.lastOk,
          fail: s.lastFail,
          total: onlyUrl ? 1 : cfg.sources.length,
          ms: s.lastDurationMs,
        },
        "[cron] cycle done",
      );
    }
  });

  // планувальник
  const job = cron.schedule(cfg.schedule, () => app.cronFeedsRun(), { timezone: cfg.timezone });
  app.addHook("onClose", async () => job.stop());

  app.addHook("onReady", async () => {
    try {
      await app.cronFeedsRun();
    } catch (err) {
      app.log.error({ err }, "[cron] initial run failed");
    }
  });

  app.log.info(
    { schedule: cfg.schedule, timezone: cfg.timezone, sources: cfg.sources },
    "[cron] scheduled",
  );
}

export default fp(plugin, { name: "feeds-cron", dependencies: ["prisma"] });
