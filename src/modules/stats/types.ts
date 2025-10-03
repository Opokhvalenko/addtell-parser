export type StatsQuery = {
  from?: string; // 'YYYY-MM-DD'
  to?: string; // 'YYYY-MM-DD'
  groupBy?: string; // 'day,event,adapter,...'
  metrics?: string; // 'count,wins,cpmAvg,...'
  limit?: number;
  offset?: number;
  format?: "json" | "csv";
  orderBy?: string; // optional, e.g. 'date,hour'
};

export type StatRow = Record<string, string | number | null>;
