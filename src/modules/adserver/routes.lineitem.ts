import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Multipart, MultipartFile } from "@fastify/multipart";
import type { Static } from "@sinclair/typebox";
import type { FastifyPluginAsync } from "fastify";
import { LineItemBody } from "./schemas.js";
import { type CreateArgs, createLineItem } from "./service/lineitem.service.js";
import {
  ensureSizesArray,
  htmlLooksSafe,
  isSafeHttpUrl,
  normalizeGeo,
  parseSizesList,
  validateCpm,
  validateFrequency,
} from "./utils/validate.js";

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
  app.post<{ Body: LineItemBodyType }>(
    "/adserver/line-items",
    { preHandler: app.authenticate, schema: { body: LineItemBody } },
    async (req, reply) => {
      if (!req.user) return reply.unauthorized();
      const userId = (req.user as { id: string }).id;
      const b = req.body;
      const sizes = ensureSizesArray(b.sizes);
      const geo = normalizeGeo(b.geo);
      validateCpm(b.minCpm, b.maxCpm);
      validateFrequency(b.frequencyPerDay);
      if (b.clickUrl && !isSafeHttpUrl(b.clickUrl)) {
        throw app.httpErrors.badRequest("clickUrl must be http(s)");
      }
      if (b.html) {
        const safe = htmlLooksSafe(b.html);
        if (!safe.ok) throw app.httpErrors.badRequest(`html not allowed: ${safe.reason}`);
      }

      const payload: CreateArgs = {
        ownerId: userId,
        name: b.name,
        sizes,
        adType: b.adType,
        geo,
        creativeId: b.creativeId,
      };
      if (typeof b.minCpm === "number") payload.minCpm = b.minCpm;
      if (typeof b.maxCpm === "number") payload.maxCpm = b.maxCpm;
      if (typeof b.frequencyPerDay === "number") payload.frequencyPerDay = b.frequencyPerDay;
      if (b.clickUrl) payload.clickUrl = b.clickUrl.trim();
      if (b.html) payload.html = b.html;

      const li = await createLineItem(app, payload);
      return reply.code(201).send({ id: li.id });
    },
  );

  app.post("/ads/lineitems", { preHandler: [app.authenticate] }, async (req, reply) => {
    if (!req.user) return reply.unauthorized();
    if (!req.isMultipart()) throw app.httpErrors.badRequest("multipart/form-data required");
    const userId = (req.user as { id: string }).id;

    const fields: Record<string, string | undefined> = {};
    let fileBuf: Buffer | null = null;
    let fileName = "creative.bin";
    let fileMime = "application/octet-stream";

    const isFile = (p: Multipart | MultipartFile): p is MultipartFile => p.type === "file";
    for await (const p of req.parts() as AsyncIterableIterator<Multipart | MultipartFile>) {
      if (isFile(p)) {
        fileName = p.filename || fileName;
        fileMime = p.mimetype || fileMime;
        fileBuf = await p.toBuffer();
      } else {
        fields[p.fieldname] = typeof p.value === "string" ? p.value : String(p.value ?? "");
      }
    }

    const rawName = fields.name?.trim() || "";
    const rawSizes = fields.sizes?.trim() || "";
    if (!rawName || !rawSizes) throw app.httpErrors.badRequest("name and sizes are required");

    const sizes = parseSizesList(rawSizes);
    const geo = normalizeGeo(fields.geo);
    const adType = parseAdType(fields.adType);
    const min = parseNumberMaybe(fields.minCpm);
    const max = parseNumberMaybe(fields.maxCpm);
    const freq = parseNumberMaybe(fields.frequencyPerDay);

    validateCpm(min, max);
    validateFrequency(freq);

    const clickUrl = (fields.clickUrl ?? "").trim();
    if (clickUrl && !isSafeHttpUrl(clickUrl)) {
      throw app.httpErrors.badRequest("clickUrl must be http(s)");
    }

    const htmlRaw = (fields.html ?? "").trim();
    if (!fileBuf && !htmlRaw) {
      throw app.httpErrors.badRequest("Either creative file, html, or creativeId is required");
    }
    if (htmlRaw) {
      const safe = htmlLooksSafe(htmlRaw);
      if (!safe.ok) throw app.httpErrors.badRequest(`html not allowed: ${safe.reason}`);
    }

    let creativeId = fields.creativeId || "";
    const uploadsRoot = app.config?.UPLOADS_DIR || path.join(process.cwd(), "uploads");
    const creativesDir = path.join(uploadsRoot, "creatives");
    await mkdir(creativesDir, { recursive: true });

    if (!creativeId) {
      if (fileBuf) {
        if (!fileMime.startsWith("image/")) {
          throw app.httpErrors.badRequest("creative file must be image/*");
        }
        const ext = path.extname(fileName) || "";
        const base = Date.now().toString(36);
        const finalName = `${base}${ext}`;
        const filePath = path.join(creativesDir, finalName);
        await writeFile(filePath, fileBuf);

        const created = await app.prisma.creative.create({
          data: {
            ownerId: userId,
            filename: finalName,
            url: `/uploads/creatives/${finalName}`,
            mime: fileMime,
          },
          select: { id: true },
        });
        creativeId = created.id;
      } else {
        const finalName = `${Date.now().toString(36)}.html`;
        const filePath = path.join(creativesDir, finalName);
        await writeFile(filePath, htmlRaw, "utf8");

        const created = await app.prisma.creative.create({
          data: {
            ownerId: userId,
            filename: finalName,
            url: `/uploads/creatives/${finalName}`,
            mime: "text/html",
            html: htmlRaw,
          },
          select: { id: true },
        });
        creativeId = created.id;
      }
    }

    const payload: CreateArgs = {
      ownerId: userId,
      name: rawName,
      sizes,
      adType,
      geo,
      creativeId,
    };
    if (typeof min === "number") payload.minCpm = min;
    if (typeof max === "number") payload.maxCpm = max;
    if (typeof freq === "number") payload.frequencyPerDay = freq;
    if (clickUrl) payload.clickUrl = clickUrl;
    if (htmlRaw) payload.html = htmlRaw;

    const { id } = await createLineItem(app, payload);
    return reply.code(201).send({ id });
  });
};

export default routes;
