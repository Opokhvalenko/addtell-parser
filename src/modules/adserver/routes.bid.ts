import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { BidQuery, SizeKey } from "./domain/types.js";
import { impressionRepo } from "./repo/impressionRepo.js";
import { metricsRepo } from "./repo/metricsRepo.js";
import { pickLineItem } from "./service/pick.js";
import { parseSizeKey } from "./util/size.js";

const BidQuerySchema = {
  type: "object",
  required: ["size"],
  properties: {
    size: { type: "string", pattern: "^[0-9]+x[0-9]+$" },
    geo: { type: "string", minLength: 2, maxLength: 8 },
    type: { type: "string" },
    uid: { type: "string" },
    floorCpm: { type: "number", minimum: 0 },
  },
  additionalProperties: false,
} as const;

type ReqWithUid = FastifyRequest & { uid?: string };

const bidRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/bid", // <-- тільки "/bid"
    { schema: { querystring: BidQuerySchema }, config: { rateLimit: { max: 120 } } },
    async (req, reply) => {
      const t0 = Date.now();
      const q = req.query as Partial<BidQuery>;

      const uid = (req as ReqWithUid).uid ?? q.uid?.toString() ?? "anon";
      const size = q.size as SizeKey;
      const type = q.type ? String(q.type) : "banner";
      const geo = q.geo ? String(q.geo).toUpperCase() : undefined;
      const floor = q.floorCpm != null ? Number(q.floorCpm) : undefined;

      const m = metricsRepo(app);
      await m.add("bid_request", {
        uid,
        tookMs: null,
        extra: { size, type, geo: geo ?? null, floor: floor ?? null },
      });
      await m.incr(`adserver:bid:${new Date().toISOString().slice(0, 10)}`, 1);

      const li = await pickLineItem(app, { size, geo, type, uid, floorCpm: floor });

      if (!li) {
        await m.add("bid_empty", { uid, tookMs: Date.now() - t0 });
        return reply.code(204).send();
      }

      await impressionRepo(app).add(uid, li.id);

      const { w, h } = parseSizeKey(li.sizes[0] || `${li.creative.width}x${li.creative.height}`);
      const adm =
        li.creative.html ?? `<img src="${li.creative.url}" width="${w}" height="${h}" alt="">`;

      await m.add("bid_filled", {
        uid,
        lineItemId: li.id,
        tookMs: Date.now() - t0,
        extra: { w, h },
      });

      return {
        lineItemId: li.id,
        cpm: li.maxCpm ?? li.minCpm ?? 0,
        w,
        h,
        adm,
        adomain: [],
        ttl: 300,
        cur: "USD",
      };
    },
  );
};

export default bidRoutes;
