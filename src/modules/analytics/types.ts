export type BaseEvent = {
  event: string;
  ts?: number;
  page?: string;
  ref?: string;
  uid?: string;
  sid?: string;
  adapter?: string;
  adUnitCode?: string;
  bidder?: string;
  creativeId?: string | number;
  cpm?: number;
  cur?: string;
  adomain?: string[];
};
