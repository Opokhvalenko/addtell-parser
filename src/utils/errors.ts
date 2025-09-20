export type NormalizedError = {
  message: string;
  name?: string;
};

export function normalizeError(e: unknown): NormalizedError {
  if (e && typeof e === "object") {
    const maybeMsg = (e as { message?: unknown }).message;
    const maybeName = (e as { name?: unknown }).name;

    const out: NormalizedError = { message: String(maybeMsg ?? e) };
    if (typeof maybeName === "string") out.name = maybeName;
    return out;
  }
  return { message: String(e) };
}
