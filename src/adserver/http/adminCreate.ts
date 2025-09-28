import type { MultipartFile } from "@fastify/multipart";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import "@fastify/multipart";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { creativeRepo } from "../repo/creativeRepo.js";
import { getCSV, getNumOrNull, getStr } from "../util/fields.js";
import { sanitizeFilename } from "../util/filename.js";
import { renderTpl } from "../util/tpl.js";

type ReqWithFile = FastifyRequest & {
  file: (opts?: { limits?: { files?: number } }) => Promise<MultipartFile>;
};

const plugin: FastifyPluginAsync = async (app) => {
  app.post("/lineitems", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    // токен
    const tokenFromBody = getStr(body, "__admin_token");
    const token = tokenFromBody ?? (req.headers["x-admin-token"] as string | undefined);
    if (process.env.ADMIN_TOKEN && token !== process.env.ADMIN_TOKEN) {
      return reply.code(401).send("unauthorized");
    }

    // файл (може бути відсутній, якщо є markdown)
    const maybeFile = await (req as ReqWithFile).file({ limits: { files: 1 } }).catch(() => null);

    const name = getStr(body, "name", "Line Item") ?? "Line Item";
    const sizes = getCSV(body, "sizes");
    if (sizes.length === 0) return reply.code(400).send("sizes required");

    const size0 = sizes.at(0);
    if (!size0) return reply.code(400).send("sizes required");
    const mm = /^(\d+)x(\d+)$/.exec(size0);
    if (!mm || !mm[1] || !mm[2]) return reply.code(400).send("bad size format, expected 300x250");
    const w = parseInt(mm[1], 10);
    const h = parseInt(mm[2], 10);

    const adType = getStr(body, "adType", "banner") ?? "banner";
    const geo = getCSV(body, "geo").map((g) => g.toUpperCase());
    const minCpm = getNumOrNull(body, "minCpm");
    const maxCpm = getNumOrNull(body, "maxCpm");
    const frequencyPerDay = Number(getStr(body, "frequencyPerDay", "0") ?? "0") || 0;
    const clickUrl = getStr(body, "clickUrl", "") ?? "";
    const markdown = getStr(body, "markdown", "") ?? "";

    if (!maybeFile && !markdown.trim()) {
      return reply.code(400).send("file or markdown required");
    }

    // директорія для ассетів
    const uploadsEnv = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
    const uploadsRoot = path.isAbsolute(uploadsEnv)
      ? uploadsEnv
      : path.resolve(process.cwd(), uploadsEnv);
    const dir = path.join(uploadsRoot, app.uid());
    await mkdir(dir, { recursive: true });

    let assetUrl = "";
    let mime = "text/html";
    let html: string | null = null;

    if (maybeFile) {
      const file = maybeFile;
      const { name: safeName } = sanitizeFilename(file.filename);
      const filePath = path.join(dir, safeName);
      const buf = await file.toBuffer();
      await writeFile(filePath, buf);

      assetUrl = `/uploads/${path.basename(dir)}/${safeName}`;
      mime = file.mimetype || "application/octet-stream";

      if (mime.includes("html") || safeName.toLowerCase().endsWith(".html")) {
        try {
          html = await readFile(filePath, "utf8");
        } catch {
          html = null;
        }
      } else if (markdown.trim()) {
        html = app.md.render(markdown);
      } else {
        const tag = `<img src="${assetUrl}" width="${w}" height="${h}" alt="">`;
        html = clickUrl ? `<a href="${clickUrl}" target="_blank" rel="noopener">${tag}</a>` : tag;
      }
    } else {
      // тільки markdown
      html = app.md.render(markdown);
      const inlinePath = path.join(dir, "creative-inline.html");
      await writeFile(inlinePath, html, "utf8");
      assetUrl = `/uploads/${path.basename(dir)}/creative-inline.html`;
      mime = "text/html";
    }

    const cRepo = creativeRepo(app);
    const creative = await cRepo.create({
      url: assetUrl,
      mime,
      width: w,
      height: h,
      html,
    });

    const li = await app.prisma.lineItem.create({
      data: { name, adType, sizes, geo, minCpm, maxCpm, frequencyPerDay, creativeId: creative.id },
    });

    reply.type("text/html").send(await renderTpl("success", { id: li.id }));
  });
};

export default plugin;
