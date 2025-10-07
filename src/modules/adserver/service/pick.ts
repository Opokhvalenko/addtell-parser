import type { FastifyInstance } from "fastify";
import { filterActive } from "../pipeline/filters/active.js";
import { filterAdType } from "../pipeline/filters/adType.js";
import { filterFloor } from "../pipeline/filters/floor.js";
import { filterGeo } from "../pipeline/filters/geo.js";
import { filterSize } from "../pipeline/filters/size.js";
import { passFrequencyCap } from "../pipeline/frequencyCap.js";
import { lineItemRepo } from "../repo/lineItemRepo.js";
import type { BidQuery } from "../types.js";

type Candidate = Awaited<ReturnType<ReturnType<typeof lineItemRepo>["findCandidates"]>>[number];
export async function pickLineItem(app: FastifyInstance, q: BidQuery) {
  const liRepo = lineItemRepo(app);
  const all = await liRepo.findCandidates({
    size: q.size,
    adType: q.type ?? "banner",
  });
  let items: Candidate[] = all.slice();
  items = filterActive(items);
  items = filterAdType(items, q.type ?? "banner");
  items = filterSize(items, q.size);
  items = q.geo ? filterGeo(items, q.geo.toUpperCase()) : items;
  items = filterFloor(items, q.floorCpm);
  const uid = q.uid ?? "anon";
  for (const li of items) {
    if (await passFrequencyCap(app, uid, li)) return li;
  }
  return null;
}
