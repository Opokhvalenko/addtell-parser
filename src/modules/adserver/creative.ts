import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { imageSize } from "image-size";
import DOMPurify from "isomorphic-dompurify";
import { ensureUploadsDir } from "../../utils/uploads.js";

/**
 * Ad creatives come from any registered user and end up on other people's pages, so:
 * - HTML is reduced to a small allowlist (no scripts, iframes, forms, SVG, event handlers,
 *   `javascript:`/`data:` links) and is stored only in the database, never as a file;
 * - images are identified by their bytes, not by the client's file name or MIME type, and get a
 *   server-generated file name (no path from user input ever reaches the file system);
 * - an existing creative can be reused only by its owner.
 * Rendering is additionally isolated in a sandboxed iframe on the frontend.
 */

const AD_TAGS = [
  "a",
  "img",
  "div",
  "span",
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "small",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
];
const AD_ATTRS = ["href", "src", "alt", "title", "width", "height", "style", "target", "rel"];
/** http(s) links and images, plus inline raster images. */
const SAFE_URI = /^(?:https?:|data:image\/(?:png|jpe?g|gif|webp);base64,)/i;

export const MAX_CREATIVE_HTML_LENGTH = 20_000;

const IMAGE_TYPES: Record<string, { ext: string; mime: string }> = {
  png: { ext: ".png", mime: "image/png" },
  jpg: { ext: ".jpg", mime: "image/jpeg" },
  gif: { ext: ".gif", mime: "image/gif" },
  webp: { ext: ".webp", mime: "image/webp" },
};

const OBJECT_ID = /^[a-f0-9]{24}$/i;

export function sanitizeCreativeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: AD_TAGS,
    ALLOWED_ATTR: AD_ATTRS,
    ALLOWED_URI_REGEXP: SAFE_URI,
    ALLOW_DATA_ATTR: false,
  }).trim();
}

/** Image type from the file contents; `null` for anything that is not a supported raster image. */
export function detectImage(buffer: Buffer) {
  try {
    const { type, width, height } = imageSize(buffer);
    const known = type ? IMAGE_TYPES[type] : undefined;
    return known ? { ...known, width: width ?? 0, height: height ?? 0 } : null;
  } catch {
    return null;
  }
}

export type CreativeInput = {
  ownerId: string;
  creativeId?: string | undefined;
  html?: string | undefined;
  image?: Buffer | null | undefined;
  /** First slot size, used as the size of an HTML creative. */
  size: { w: number; h: number };
};

/** Returns the id of the creative to use: an own existing one, or a newly stored one. */
export async function resolveCreative(app: FastifyInstance, input: CreativeInput): Promise<string> {
  if (input.creativeId) {
    const own = OBJECT_ID.test(input.creativeId)
      ? await app.prisma.creative.findFirst({
          where: { id: input.creativeId, ownerId: input.ownerId },
          select: { id: true },
        })
      : null;
    // Same answer for "does not exist" and "belongs to someone else"
    if (!own) throw app.httpErrors.notFound("Creative not found");
    return own.id;
  }

  if (input.image) {
    const image = detectImage(input.image);
    if (!image) throw app.httpErrors.badRequest("Creative must be a PNG, JPEG, GIF or WebP image");
    const filename = `${randomUUID()}${image.ext}`;
    await writeFile(join(await ensureUploadsDir(app), filename), input.image);
    const created = await app.prisma.creative.create({
      data: {
        ownerId: input.ownerId,
        filename,
        url: `/uploads/creatives/${filename}`,
        mime: image.mime,
        width: image.width,
        height: image.height,
      },
      select: { id: true },
    });
    return created.id;
  }

  if (input.html !== undefined) {
    if (input.html.length > MAX_CREATIVE_HTML_LENGTH) {
      throw app.httpErrors.badRequest(`HTML is longer than ${MAX_CREATIVE_HTML_LENGTH} characters`);
    }
    const html = sanitizeCreativeHtml(input.html);
    if (!html) throw app.httpErrors.badRequest("HTML has no allowed content");
    const created = await app.prisma.creative.create({
      data: {
        ownerId: input.ownerId,
        // Stored only in the database: no file, no URL on the API origin
        filename: "",
        url: "",
        mime: "text/html",
        html,
        width: input.size.w,
        height: input.size.h,
      },
      select: { id: true },
    });
    return created.id;
  }

  throw app.httpErrors.badRequest("Either an image, HTML or creativeId is required");
}
