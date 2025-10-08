export const SIZE_RE = /^\d+x\d+$/i;
export const SIZE_LIST_RE = /^\s*\d+x\d+(?:\s*,\s*\d+x\d+)*\s*$/i;
export function parseSizesList(input: string): string[] {
  if (!SIZE_LIST_RE.test(String(input || ""))) {
    throw new Error("sizes must look like 300x250,300x600");
  }
  return String(input)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => SIZE_RE.test(s));
}
export function ensureSizesArray(arr: string[]): string[] {
  const res = (arr || []).map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (res.length === 0 || !res.every((s) => SIZE_RE.test(s))) {
    throw new Error("sizes must look like 300x250,300x600");
  }
  return res;
}
export function normalizeGeo(list: string[] | string | undefined): string[] {
  const raw = typeof list === "string" ? list.split(",") : Array.isArray(list) ? list : [];
  return raw.map((s) => s.trim().toUpperCase()).filter(Boolean);
}
export function isSafeHttpUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
export function htmlLooksSafe(html: string): { ok: boolean; reason?: string } {
  const h = String(html || "");
  if (!h.trim()) return { ok: false, reason: "empty html" };
  if (/<script\b/i.test(h)) return { ok: false, reason: "script tag is not allowed" };
  if (/on\w+\s*=/i.test(h)) return { ok: false, reason: "inline event handlers are not allowed" };
  if (/javascript:/i.test(h)) return { ok: false, reason: "javascript: URLs are not allowed" };
  return { ok: true };
}
export function validateCpm(min?: number, max?: number) {
  if (typeof min === "number" && min < 0) throw new Error("minCpm must be ≥ 0");
  if (typeof max === "number" && max < 0) throw new Error("maxCpm must be ≥ 0");
  if (typeof min === "number" && typeof max === "number" && max < min) {
    throw new Error("maxCpm must be ≥ minCpm");
  }
}
export function validateFrequency(n?: number) {
  if (typeof n === "number" && (!Number.isFinite(n) || n < 0)) {
    throw new Error("frequencyPerDay must be ≥ 0");
  }
}
