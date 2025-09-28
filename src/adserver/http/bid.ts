import type { FastifyPluginAsync } from "fastify";
import type { SizeKey } from "../domain/types.js";
import { filterActive } from "../pipeline/filters/active.js";
import { filterAdType } from "../pipeline/filters/adType.js";
import { filterFloor } from "../pipeline/filters/floor.js";
import { filterGeo } from "../pipeline/filters/geo.js";
import { filterSize } from "../pipeline/filters/size.js";
import { type Filter, runPipeline } from "../pipeline/index.js";
import { impressionRepo } from "../repo/impressionRepo.js";
import { lineItemRepo } from "../repo/lineItemRepo.js";
import { metricsRepo } from "../repo/metricsRepo.js";
import { parseSizeKey } from "../util/size.js";

const plugin: FastifyPluginAsync = async (app) => {
  app.get("/bid", { config: { rateLimit: { max: 120 } } }, async (req, reply) => {
    const t0 = Date.now();
    const q = req.query as Partial<{
      size: string;
      type: string;
      geo: string;
      uid: string;
      floorCpm: number;
    }>;
    const size = String(q.size || "");
    if (!/^\d+x\d+$/.test(size)) return reply.code(400).send({ error: "size must be 300x250" });

    const uid = (q.uid && String(q.uid)) || "anon";
    const type = q.type ? String(q.type) : "banner";
    const geo = q.geo ? String(q.geo).toUpperCase() : undefined;
    const floor = q.floorCpm != null ? Number(q.floorCpm) : undefined;

    const m = metricsRepo(app);
    await m.add("bid_request", {
      uid,
      tookMs: null,
      extra: {
        size,
        type,
        geo: geo ?? null,
        floor: floor ?? null,
      },
    });
    await m.incr(`adserver:bid:${new Date().toISOString().slice(0, 10)}`, 1);

    const repo = lineItemRepo(app);
    const initial = await repo.findCandidates({ size: size as SizeKey, adType: type });

    const filters: Filter<(typeof initial)[number]>[] = [
      { name: "active", run: (arr) => filterActive(arr) },
      { name: "adType", run: (arr) => filterAdType(arr, type) },
      { name: "size", run: (arr) => filterSize(arr, size) },
      { name: "geo", run: (arr) => filterGeo(arr, geo) },
      { name: "floor", run: (arr) => filterFloor(arr, floor) },
    ];

    const { winner, trace } = await runPipeline(initial, filters);

    if (!winner) {
      await m.add("bid_empty", { uid, tookMs: Date.now() - t0, extra: { trace } });
      return reply.code(204).send();
    }

    // частота показів
    const hours = Number(process.env.FREQUENCY_WINDOW_HOURS || 24);
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const seen = await app.prisma.impression.count({
      where: { uid, lineItemId: winner.id, at: { gte: since } },
    });
    if (winner.frequencyPerDay && seen >= winner.frequencyPerDay) {
      await m.add("bid_empty", {
        uid,
        tookMs: Date.now() - t0,
        extra: { reason: "freq_cap", trace },
      });
      return reply.code(204).send();
    }

    // запис імпресії
    const iRepo = impressionRepo(app);
    await iRepo.add(uid, winner.id);

    const { w, h } = parseSizeKey(
      winner.sizes[0] || `${winner.creative.width}x${winner.creative.height}`,
    );

    const adm =
      winner.creative.html ??
      `<img src="${winner.creative.url}" width="${w}" height="${h}" alt="">`;

    await m.add("bid_filled", {
      uid,
      lineItemId: winner.id,
      tookMs: Date.now() - t0,
      extra: { trace, w, h },
    });

    return {
      lineItemId: winner.id,
      cpm: winner.maxCpm ?? winner.minCpm ?? 0,
      w,
      h,
      adm,
      adomain: [],
      ttl: 300,
      cur: "USD",
    };
  });
};

export default plugin;
