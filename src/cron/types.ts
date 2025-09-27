export type CronLastError = {
  name?: string;
  message?: string;
  url?: string;
  at: Date;
};

export interface CronConfig {
  schedule: string;
  timezone: string;
  outPath: string;
  take: number;
  historyLimit: number;
  sources: string[];
}

export interface CronStatus {
  schedule: string;
  timezone: string;
  sources: string[];
  outPath: string;
  take: number;
  historyLimit: number;

  cycles: number;
  processStartedAt: Date;
  uptimeMs: number;
  uptimeHuman: string;

  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastOk: number;
  lastFail: number;
  lastDurationMs: number;
  durations: number[];

  lastError: CronLastError | null;
}

export interface FeedItemLite {
  link: string;
  title: string;
  guid: string | null;
  pubDate: Date | null;
}

export interface FeedSnapshotItem {
  url: string;
  title: string | null;
  count: number;
  items: FeedItemLite[];
}

export interface FeedsJson {
  updatedAt: string;
  feeds: FeedSnapshotItem[];
}
