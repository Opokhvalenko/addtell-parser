export type SizeKey = `${number}x${number}`;

export function toSizeKey(w: number, h: number): SizeKey {
  return `${w}x${h}` as SizeKey;
}

export function parseSizeKey(k: string): { w: number; h: number } {
  const m = /^(\d+)x(\d+)$/i.exec(k);
  if (!m) throw new Error("bad size");
  const ws = m[1];
  const hs = m[2];
  if (!ws || !hs) throw new Error("bad size");
  return { w: parseInt(ws, 10), h: parseInt(hs, 10) };
}
