export const filterActive = <T extends { active?: boolean }>(items: T[]) =>
  items.filter((i) => i.active ?? true);
