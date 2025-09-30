export const filterGeo = <T extends { geo?: string[] | null }>(items: T[], geo?: string) =>
  !geo ? items : items.filter((i) => !i.geo?.length || i.geo.includes(geo));
