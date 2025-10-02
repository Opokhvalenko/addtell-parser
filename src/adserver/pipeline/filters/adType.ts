export const filterAdType = <T extends { adType: string }>(items: T[], type = "banner") =>
  items.filter((i) => i.adType === type);
