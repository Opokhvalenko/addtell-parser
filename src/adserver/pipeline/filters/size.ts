export const filterSize = <T extends { sizes: string[] }>(items: T[], size: string) =>
  items.filter((i) => Array.isArray(i.sizes) && i.sizes.includes(size));
