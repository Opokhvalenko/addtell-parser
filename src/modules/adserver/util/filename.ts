import path from "node:path";

const ALLOWED = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".html"]);
export function sanitizeFilename(original: string) {
  const base = path.basename(original || "file");
  const ext = path.extname(base).toLowerCase();
  if (!ALLOWED.has(ext)) throw new Error("unsupported file type");
  const name = base.replace(/[^a-z0-9_.-]/gi, "_");
  return { name, ext };
}
