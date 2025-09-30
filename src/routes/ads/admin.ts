import type { MultipartFile } from "@fastify/multipart";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import "@fastify/multipart";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { adminGuard } from "../../adserver/http/adminGuard.js";
import { creativeRepo } from "../../adserver/repo/creativeRepo.js";
import { renderTpl } from "../../adserver/util/tpl.js";

type ReqWithFile = FastifyRequest & {
  file: (opts?: { limits?: { files?: number } }) => Promise<MultipartFile>;
};

const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get("/form", { preHandler: adminGuard }, async (_req, reply) => {
    reply.type("text/html").send(await renderTpl("form"));
  });

  app.post("/lineitems", { preHandler: adminGuard }, async (req, reply) => {
    const file = await (req as ReqWithFile).file({ limits: { files: 1 } }).catch(() => null);
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!file) return reply.code(400).send({ error: "creative required" });

    const name = String((body.name as string | undefined) ?? "Line Item");
    const sizes: string[] = String((body.sizes as string | undefined) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (sizes.length === 0) return reply.code(400).send({ error: "sizes required" });

    const adType = String((body.adType as string | undefined) ?? "banner");
    const geo = String((body.geo as string | undefined) ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const minCpm = body.minCpm ? Number(body.minCpm) : null;
    const maxCpm = body.maxCpm ? Number(body.maxCpm) : null;
    const frequencyPerDay = body.frequencyPerDay ? Number(body.frequencyPerDay) : 0;
    const clickUrl = String((body.clickUrl as string | undefined) ?? "");

    const root = path.join(process.cwd(), "public", "ads");
    await mkdir(root, { recursive: true });
    const stamp = Date.now().toString(36);
    const dir = path.join(root, stamp);
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, file.filename);
    const buf = await file.toBuffer();
    await writeFile(filePath, buf);

    // безпечний парс першого розміру
    const size0 = sizes.at(0);
    if (!size0) return reply.code(400).send({ error: "sizes required" });
    const mm = /^(\d+)x(\d+)$/.exec(size0);
    if (!mm) return reply.code(400).send({ error: "bad size format, expected 300x250" });
    const ws = mm[1];
    const hs = mm[2];
    if (!ws || !hs) return reply.code(400).send({ error: "bad size format, expected 300x250" });
    const w = parseInt(ws, 10);
    const h = parseInt(hs, 10);

    let html: string | null = null;
    const ext = path.extname(file.filename).toLowerCase();
    const mime = file.mimetype || "application/octet-stream";
    if (mime.includes("html") || ext === ".html") {
      try {
        html = await readFile(filePath, "utf8");
      } catch {
        html = null;
      }
    } else {
      const src = `/ads/${stamp}/${file.filename}`;
      const tag = `<img src="${src}" width="${w}" height="${h}" alt="">`;
      html = clickUrl ? `<a href="${clickUrl}" target="_blank" rel="noopener">${tag}</a>` : tag;
    }

    const cRepo = creativeRepo(app);
    const creative = await cRepo.create({
      url: `/ads/${stamp}/${file.filename}`,
      mime,
      width: w,
      height: h,
      html,
    });

    const lineItem = await app.prisma.lineItem.create({
      data: { name, adType, sizes, geo, minCpm, maxCpm, frequencyPerDay, creativeId: creative.id },
      include: { creative: true },
    });

    reply.code(201).send({ ok: true, lineItem });
  });
};

export default adminRoutes;
