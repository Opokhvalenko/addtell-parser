// тип ключа розміру
export type SizeKey = `${number}x${number}`;

// запит від клієнта на підбір реклами
export type BidQuery = {
  size: SizeKey;
  geo?: string | undefined;
  type?: string | undefined;
  uid?: string | undefined;
  floorCpm?: number | undefined;
};
