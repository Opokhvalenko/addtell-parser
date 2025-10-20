export type BaseEvent = {
  event: string;
  ts?: string | Date;
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

export interface StatsQuery {
  from: string | Date;
  to: string | Date;
  groupBy?: string | string[];
  metrics?: string | string[];
  orderBy?: string;
  limit?: number;
  offset?: number;
}

export type StatRow = Record<string, string | number | null>;
