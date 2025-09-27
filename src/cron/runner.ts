import type { FastifyInstance } from "fastify";
import { getOrParseFeed } from "../services/feedService.js";
import { buildFeedsSnapshot, writeSnapshot } from "./snapshot.js";

export type RunOpts = {
  app: FastifyInstance;
  sources: string[];
  outPath: string;
  take: number;
  markOk: () => void;
  markFail: (err: Error, url?: string) => void;
};

export async function runFeedsCycle(opts: RunOpts): Promise<void> {
  const { app, sources, take, outPath, markOk, markFail } = opts;

  // 1) синх/парс кожного фіда
  for (const url of sources) {
    try {
      const { items } = await getOrParseFeed(app, url);
      app.log.info({ url, count: items.length }, "[cron] feed synced");
      markOk();
    } catch (err) {
      const e = err as Error;
      app.log.error({ url, name: e?.name, msg: e?.message }, "[cron] feed sync failed");
      markFail(e, url);
    }
  }

  // 2) snapshot по ВСІХ sources (не лише onlyUrl)
  const snapshot = await buildFeedsSnapshot(app, sources, take);
  await writeSnapshot(outPath, { updatedAt: new Date().toISOString(), feeds: snapshot });
}
