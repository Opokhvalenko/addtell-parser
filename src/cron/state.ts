import { fmtHMS } from "../lib/time.js";
import type { CronConfig, CronLastError, CronStatus } from "./types.js";

export function createCronState(cfg: CronConfig) {
  const processStartedAt = new Date();

  let running = false;
  let cycles = 0;

  let lastStartedAt: Date | null = null;
  let lastFinishedAt: Date | null = null;
  let lastOk = 0;
  let lastFail = 0;
  let lastError: CronLastError | null = null;
  const durations: number[] = [];

  return {
    isRunning: () => running,

    start() {
      running = true;
      cycles++;
      lastStartedAt = new Date();
      lastOk = 0;
      lastFail = 0;
      lastError = null;
    },

    markOk() {
      lastOk++;
    },

    markFail(err?: Error, url?: string) {
      lastFail++;
      lastError = {
        ...(err?.name ? { name: err.name } : {}),
        ...(err?.message ? { message: err.message } : {}),
        ...(url ? { url } : {}),
        at: new Date(),
      };
    },

    finish(ms: number) {
      lastFinishedAt = new Date();
      durations.push(ms);
      if (durations.length > cfg.historyLimit) {
        durations.splice(0, durations.length - cfg.historyLimit);
      }
      running = false;
    },

    status(): CronStatus {
      const uptimeMs = Date.now() - processStartedAt.getTime();
      return {
        schedule: cfg.schedule,
        timezone: cfg.timezone,
        sources: cfg.sources,
        outPath: cfg.outPath,
        take: cfg.take,
        historyLimit: cfg.historyLimit,

        cycles,
        processStartedAt,
        uptimeMs,
        uptimeHuman: fmtHMS(uptimeMs),

        lastStartedAt,
        lastFinishedAt,
        lastOk,
        lastFail,
        lastDurationMs: durations[durations.length - 1] ?? 0,
        durations: [...durations],

        lastError,
      };
    },
  };
}

export type CronState = ReturnType<typeof createCronState>;
