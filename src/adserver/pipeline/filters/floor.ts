export const filterFloor = <T extends { minCpm: number | null; maxCpm: number | null }>(
  items: T[],
  floor?: number,
) => {
  if (floor == null) return items;
  return items.filter((i) => (i.minCpm ?? 0) <= floor && (i.maxCpm ?? Infinity) >= floor);
};
