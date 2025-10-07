export type BaseEvent = {
  event: string;
  ts?: string | Date; // важливо: без number
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

/** Параметри статистики з роутів (?from, ?to, …) */
export interface StatsQuery {
  from: string | Date;
  to: string | Date;
  groupBy?: string | string[];
  metrics?: string | string[];
  orderBy?: string;
  limit?: number;
  offset?: number;
}

/** Рядок відповіді зі /stats */
export type StatRow = Record<string, string | number | null>;
