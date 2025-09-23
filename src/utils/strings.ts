export const toStr = (v: unknown): string =>
  typeof v === "string" ? v : v == null ? "" : String(v);
