/** A client mistake: the error handler answers 400 with this message. */
function badRequest(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 400 });
}

export const SIZE_RE = /^\d+x\d+$/i;
export const SIZE_LIST_RE = /^\s*\d+x\d+(?:\s*,\s*\d+x\d+)*\s*$/i;
export function parseSizesList(input: string): string[] {
  if (!SIZE_LIST_RE.test(String(input || ""))) {
    throw badRequest("sizes must look like 300x250,300x600");
  }
  return String(input)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => SIZE_RE.test(s));
}
export function ensureSizesArray(arr: string[]): string[] {
  const res = (arr || []).map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (res.length === 0 || !res.every((s) => SIZE_RE.test(s))) {
    throw badRequest("sizes must look like 300x250,300x600");
  }
  return res;
}
export function normalizeGeo(list: string[] | string | undefined): string[] {
  const raw = typeof list === "string" ? list.split(",") : Array.isArray(list) ? list : [];
  return raw.map((s) => s.trim().toUpperCase()).filter(Boolean);
}
export function validateCpm(min?: number, max?: number) {
  if (typeof min === "number" && min < 0) throw badRequest("minCpm must be ≥ 0");
  if (typeof max === "number" && max < 0) throw badRequest("maxCpm must be ≥ 0");
  if (typeof min === "number" && typeof max === "number" && max < min) {
    throw badRequest("maxCpm must be ≥ minCpm");
  }
}
export function validateFrequency(n?: number) {
  if (typeof n === "number" && (!Number.isFinite(n) || n < 0)) {
    throw badRequest("frequencyPerDay must be ≥ 0");
  }
}
