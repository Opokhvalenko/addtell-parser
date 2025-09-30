import type { FastifyPluginAsync } from "fastify";
import type { BidQuery, SizeKey } from "../../adserver/domain/types.js";
import { impressionRepo } from "../../adserver/repo/impressionRepo.js";
import { pickLineItem } from "../../adserver/service/pick.js";
import { parseSizeKey } from "../../adserver/util/size.js";

const bidRoutes: FastifyPluginAsync = async (app) => {
  app.get("/bid", async (req, reply) => {
    const q = req.query as Partial<BidQuery>;

    const sizeStr = String(q.size || "");
    if (!/^\d+x\d+$/.test(sizeStr)) {
      return reply.code(400).send({ error: "size must be 300x250" });
    }

    const li = await pickLineItem(app, {
      size: sizeStr as SizeKey,
      geo: q.geo ? q.geo.toString().toUpperCase() : undefined,
      type: q.type ? q.type.toString() : undefined,
      uid: q.uid ? q.uid.toString() : undefined,
      floorCpm: q.floorCpm != null ? Number(q.floorCpm) : undefined,
    });

    if (!li) return reply.code(204).send();

    // запис імпресії
    const iRepo = impressionRepo(app);
    await iRepo.add(q.uid?.toString() || "anon", li.id);

    const { w, h } = parseSizeKey(li.sizes[0] || `${li.creative.width}x${li.creative.height}`);
    const adm =
      li.creative.html ?? `<img src="${li.creative.url}" width="${w}" height="${h}" alt="">`;

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
  });
};

export default bidRoutes;
