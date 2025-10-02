import { promises as fs } from "node:fs";
import path from "node:path";
import type { MultipartFile } from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { imageSize } from "image-size";
import { nid } from "../../utils/id.js";

type SaveArgs = { ownerId: string; file: MultipartFile };
export type SaveCreativeResult = {
  id: string;
  url: string;
  filename: string;
  mime: string | null;
};
type BusboyStream = { truncated?: boolean };

const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function saveCreativeFromMultipart(
  app: FastifyInstance,
  args: SaveArgs,
): Promise<SaveCreativeResult> {
  const uploadsDir = app.config.UPLOADS_DIR ?? "uploads";
  const file = args.file;

  const origName = typeof file.filename === "string" ? file.filename : "file";
  const ext = path.extname(origName).toLowerCase();
  const mime = typeof file.mimetype === "string" ? file.mimetype : null;

  if (!ALLOWED_EXT.has(ext)) throw app.httpErrors.badRequest("Unsupported file extension");
  if (!mime || !ALLOWED_MIME.has(mime)) throw app.httpErrors.badRequest("Unsupported content-type");
  if ((file as unknown as { file?: BusboyStream }).file?.truncated === true) {
    throw app.httpErrors.payloadTooLarge("File size limit exceeded");
  }

  const name = `${nid()}${ext}`;
  const dirAbs = path.resolve(process.cwd(), uploadsDir);
  const abs = path.join(dirAbs, name);
  const url = path.posix.join("/uploads/", name);

  await fs.mkdir(dirAbs, { recursive: true });
  const buf = await file.toBuffer();
  await fs.writeFile(abs, buf);

  const dim = imageSize(buf);
  const width = dim.width ?? 0;
  const height = dim.height ?? 0;

  const creative = await app.prisma.creative.create({
    data: {
      ownerId: args.ownerId,
      filename: name,
      url,
      mime,
      width,
      height,
      html: null,
      meta: { originalName: origName, size: buf.length },
    },
    select: { id: true, url: true, filename: true, mime: true },
  });

  return creative;
}
