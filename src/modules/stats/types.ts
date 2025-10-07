export type StatsQuery = {
  from?: string;
  to?: string;
  groupBy?: string;
  metrics?: string;
  limit?: number;
  offset?: number;
  format?: "json" | "csv";
  orderBy?: string;
};
export type StatRow = Record<string, string | number | null>;
