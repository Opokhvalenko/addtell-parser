export type SizeKey = `${number}x${number}`;
export type BidQuery = {
  size: SizeKey;
  geo?: string | undefined;
  type?: string | undefined;
  uid?: string | undefined;
  floorCpm?: number | undefined;
};
