import type { Multipart, MultipartFile } from "@fastify/multipart";
import type { Static } from "@sinclair/typebox";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { resolveCreative } from "./creative.js";
import { impressionRepo } from "./repo/impressionRepo.js";
import { metricsRepo } from "./repo/metricsRepo.js";
import { LineItemBody } from "./schemas.js";
import { type CreateArgs, createLineItem } from "./service/create.js";
import { pickLineItem } from "./service/pick.js";
import type { BidQuery, SizeKey } from "./types.js";
import { parseSizeKey } from "./util/size.js";
import {
  ensureSizesArray,
  normalizeGeo,
  parseSizesList,
  validateCpm,
  validateFrequency,
} from "./utils/validate.js";

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
type LineItemBodyType = Static<typeof LineItemBody>;

const AD_TYPES = ["banner", "video", "native"] as const;
type AdType = (typeof AD_TYPES)[number];

function isAdType(x: string): x is AdType {
  return (AD_TYPES as readonly string[]).includes(x);
}

function parseAdType(v: unknown): AdType {
  const s = String(v ?? "").toLowerCase();
  return isAdType(s) ? s : "banner";
}

function parseNumberMaybe(x: string | undefined): number | undefined {
  if (x == null) return undefined;
  const t = x.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isNaN(n) ? undefined : n;
}

const routes: FastifyPluginAsync = async (app) => {
  app.get(
    "/bid",
    {
      schema: { querystring: BidQuerySchema },
      // Called anonymously by publisher pages
      config: { public: true, rateLimit: { max: 120 } },
    },
    async (req, reply) => {
      const startedAt = Date.now();
      const q = req.query as Partial<BidQuery>;

      const uid = getUserId(req as ReqWithUid, q.uid);
      const size = getSizeKey(q.size);
      const type = parseAdType(q.type);
      const geo = getGeo(q.geo);
      const floor = getFloor(q.floorCpm);

      const m = metricsRepo(app);

      try {
        await m.add("bid_request", {
          uid,
          tookMs: null,
          extra: { size, type, geo: geo ?? null, floor: floor ?? null },
        });
        await m.incr(`adserver:bid:${new Date().toISOString().slice(0, 10)}`, 1);
      } catch (err) {
        app.log.warn({ err }, "[adserver] metrics: failed to write bid_request");
      }

      try {
        const lineItem = await pickLineItem(app, {
          size,
          geo,
          type,
          uid,
          floorCpm: floor,
        });

        if (!lineItem) {
          try {
            await m.add("bid_empty", { uid, tookMs: Date.now() - startedAt });
          } catch (err) {
            app.log.warn({ err }, "[adserver] metrics: failed to write bid_empty");
          }
          return reply.code(204).send();
        }

        try {
          await impressionRepo(app).add(uid, lineItem.id);
        } catch (err) {
          app.log.warn({ err }, "[adserver] impressionRepo.add failed");
        }

        const { w, h } = getCreativeSize(lineItem);
        const adm = getAdMarkup(lineItem, w, h);

        try {
          await m.add("bid_filled", {
            uid,
            lineItemId: lineItem.id,
            tookMs: Date.now() - startedAt,
            extra: { w, h },
          });
        } catch (err) {
          app.log.warn({ err }, "[adserver] metrics: failed to write bid_filled");
        }

        return {
          lineItemId: lineItem.id,
          cpm: resolveCpm(lineItem),
          w,
          h,
          adm,
          adomain: [],
          ttl: 300,
          cur: "USD",
        };
      } catch (err: unknown) {
        try {
          await m.add("bid_error", {
            uid,
            tookMs: Date.now() - startedAt,
            extra: { message: (err as Error)?.message ?? "unknown" },
          });
        } catch (e) {
          app.log.warn({ err: e }, "[adserver] metrics: failed to write bid_error");
        }
        app.log.error({ err }, "[adserver] /bid failed");
        throw app.httpErrors.internalServerError(
          (err as Error)?.message ?? "bid processing failed",
        );
      }
    },
  );

  app.post<{ Body: LineItemBodyType }>(
    "/adserver/line-items",
    { schema: { body: LineItemBody } },
    async (req, reply) => {
      const ownerId = (req.user as { id: string }).id;
      const b = req.body;

      const sizes = ensureSizesArray(b.sizes);
      validateCpm(b.minCpm, b.maxCpm);
      validateFrequency(b.frequencyPerDay);

      const creativeId = await resolveCreative(app, {
        ownerId,
        creativeId: b.creativeId,
        html: b.html,
        size: firstSize(sizes),
      });

      const payload: CreateArgs = {
        ownerId,
        name: b.name,
        sizes,
        adType: b.adType,
        geo: normalizeGeo(b.geo),
        creativeId,
      };
      if (typeof b.minCpm === "number") payload.minCpm = b.minCpm;
      if (typeof b.maxCpm === "number") payload.maxCpm = b.maxCpm;
      if (typeof b.frequencyPerDay === "number") payload.frequencyPerDay = b.frequencyPerDay;

      const li = await createLineItem(app, payload);
      return reply.code(201).send({ id: li.id });
    },
  );

  // Form submit from the "Create ad" page (multipart: optional image file)
  app.post("/ads/lineitems", async (req, reply) => {
    if (!req.isMultipart()) throw app.httpErrors.badRequest("multipart/form-data required");
    const ownerId = (req.user as { id: string }).id;

    const fields: Record<string, string | undefined> = {};
    let image: Buffer | null = null;
    const isFile = (p: Multipart | MultipartFile): p is MultipartFile => p.type === "file";
    for await (const p of req.parts() as AsyncIterableIterator<Multipart | MultipartFile>) {
      if (isFile(p)) {
        // The client's file name and MIME type are ignored: the bytes decide the type
        image = await p.toBuffer();
      } else {
        fields[p.fieldname] = typeof p.value === "string" ? p.value : String(p.value ?? "");
      }
    }

    const name = fields.name?.trim() || "";
    const rawSizes = fields.sizes?.trim() || "";
    if (!name || !rawSizes) throw app.httpErrors.badRequest("name and sizes are required");

    const sizes = parseSizesList(rawSizes);
    const min = parseNumberMaybe(fields.minCpm);
    const max = parseNumberMaybe(fields.maxCpm);
    const freq = parseNumberMaybe(fields.frequencyPerDay);
    validateCpm(min, max);
    validateFrequency(freq);

    const html = fields.html?.trim() || undefined;
    const creativeId = await resolveCreative(app, {
      ownerId,
      creativeId: fields.creativeId?.trim() || undefined,
      image: image && image.length > 0 ? image : null,
      html,
      size: firstSize(sizes),
    });

    const payload: CreateArgs = {
      ownerId,
      name,
      sizes,
      adType: parseAdType(fields.adType),
      geo: normalizeGeo(fields.geo),
      creativeId,
    };
    if (typeof min === "number") payload.minCpm = min;
    if (typeof max === "number") payload.maxCpm = max;
    if (typeof freq === "number") payload.frequencyPerDay = freq;

    const { id } = await createLineItem(app, payload);
    return reply.code(201).send({ id });
  });
};

function firstSize(sizes: string[]): { w: number; h: number } {
  const [w = 0, h = 0] = (sizes[0] ?? "").split("x").map(Number);
  return { w, h };
}

function getUserId(req: ReqWithUid, queryUid: unknown): string {
  if (req.uid) return req.uid;
  if (queryUid !== undefined && queryUid !== null) return String(queryUid);
  return "anon";
}

function getGeo(queryGeo: unknown): string | undefined {
  if (queryGeo !== undefined && queryGeo !== null) {
    return String(queryGeo).toUpperCase();
  }
  return undefined;
}

function getFloor(queryFloor: unknown): number | undefined {
  if (queryFloor !== undefined && queryFloor !== null) {
    const n = Number(queryFloor);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function getSizeKey(querySize: unknown): SizeKey {
  if (querySize && typeof querySize === "string") {
    return querySize as SizeKey;
  }
  return "300x250";
}

function getCreativeSize(lineItem: {
  sizes?: string[];
  creative: { width?: number | null; height?: number | null };
}) {
  let w = 0;
  let h = 0;

  const fallbackSize =
    (lineItem.creative.width ?? 0) > 0 && (lineItem.creative.height ?? 0) > 0
      ? `${lineItem.creative.width}x${lineItem.creative.height}`
      : "0x0";

  const sizeKey =
    Array.isArray(lineItem.sizes) && lineItem.sizes.length > 0 ? lineItem.sizes[0] : fallbackSize;

  try {
    const parsed = parseSizeKey(sizeKey || "300x250");
    w = parsed.w;
    h = parsed.h;
  } catch {
    if ((lineItem.creative.width ?? 0) > 0 && (lineItem.creative.height ?? 0) > 0) {
      w = lineItem.creative.width as number;
      h = lineItem.creative.height as number;
    } else {
      w = 300;
      h = 250;
    }
  }

  return { w, h };
}

function getAdMarkup(
  lineItem: { creative: { html?: string | null; url?: string | null } },
  w: number,
  h: number,
): string {
  if (lineItem.creative.html && lineItem.creative.html.length > 0) {
    return lineItem.creative.html;
  }
  if (lineItem.creative.url && lineItem.creative.url.length > 0) {
    return `<img src="${lineItem.creative.url}" width="${w}" height="${h}" alt="">`;
  }
  return "";
}

function resolveCpm(lineItem: { minCpm?: number | null; maxCpm?: number | null }): number {
  if (typeof lineItem.maxCpm === "number") return lineItem.maxCpm;
  if (typeof lineItem.minCpm === "number") return lineItem.minCpm;
  return 0;
}

export default routes;
