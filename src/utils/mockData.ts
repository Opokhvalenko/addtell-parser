import type { StatRow } from "../modules/stats/types.js";

/**
 * Mock дані для статистики - використовуються коли ClickHouse недоступний
 * або повертає порожні результати
 */
export const MOCK_STATS_DATA: StatRow[] = [
  {
    ts: "2025-01-03T00:00:00.000Z",
    date: "2025-01-03",
    event: "bidWon",
    adapter: "beautifulAd",
    count: 15,
    wins: 12,
    cpmAvg: 0.85,
  },
  {
    ts: "2025-01-04T00:00:00.000Z",
    date: "2025-01-04",
    event: "bidWon",
    adapter: "adtelligent",
    count: 23,
    wins: 18,
    cpmAvg: 1.2,
  },
  {
    ts: "2025-01-05T00:00:00.000Z",
    date: "2025-01-05",
    event: "bidWon",
    adapter: "bidmatic",
    count: 31,
    wins: 25,
    cpmAvg: 0.95,
  },
];
