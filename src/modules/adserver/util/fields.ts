function extractString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const maybe = (v as { value?: unknown }).value;
    if (typeof maybe === "string") return maybe;
  }
  return undefined;
}

export function getStr(
  body: Record<string, unknown>,
  name: string,
  fallback?: string,
): string | undefined {
  const raw = extractString(body[name]);
  return raw !== undefined ? raw : fallback;
}

export function getCSV(body: Record<string, unknown>, name: string): string[] {
  const s = getStr(body, name) ?? "";
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function getNumOrNull(body: Record<string, unknown>, name: string): number | null {
  const s = getStr(body, name);
  if (s == null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
