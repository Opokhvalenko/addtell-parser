import { type ClickHouseClient, createClient } from "@clickhouse/client";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const CONNECT_TIMEOUT_MS = Number(process.env.CLICKHOUSE_CONNECT_TIMEOUT_MS ?? 3000);
const PING_TIMEOUT_MS = Number(process.env.CLICKHOUSE_PING_TIMEOUT_MS ?? 2000);

function withTimeout<T>(p: Promise<T>, ms: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e as unknown as Error);
    });
  });
}

const plugin: FastifyPluginAsync = async (app) => {
  const cfg = app.config as Record<string, unknown>;

  const enabled = String(cfg.CLICKHOUSE_ENABLE ?? "true").toLowerCase() !== "false";
  if (!enabled) {
    app.log.warn("[clickhouse] disabled via CLICKHOUSE_ENABLE=false");
    return;
  }

  const url = String(cfg.CLICKHOUSE_URL ?? "");
  if (!url) {
    app.log.warn("[clickhouse] no CLICKHOUSE_URL — starting without ClickHouse");
    return;
  }

  const username = String(cfg.CLICKHOUSE_USER ?? "").trim() || undefined;
  const password = String(cfg.CLICKHOUSE_PASSWORD ?? "").trim() || undefined;
  const database = String(cfg.CLICKHOUSE_DB ?? "").trim() || undefined;
  const table = String(cfg.CLICKHOUSE_TABLE ?? "events").trim() || "events";

  type CHOptions = Parameters<typeof createClient>[0];

  const clientOptions: CHOptions = {
    url,
    request_timeout: CONNECT_TIMEOUT_MS,
  };
  if (username) clientOptions.username = username;
  if (password) clientOptions.password = password;
  if (database) clientOptions.database = database;

  const client: ClickHouseClient = createClient(clientOptions);

  app.decorate("clickhouse", client);
  app.addHook("onClose", async () => {
    try {
      await client.close();
    } catch {
      /* ignore */
    }
  });

  try {
    await withTimeout(client.ping(), PING_TIMEOUT_MS, "clickhouse.ping");
    app.log.info({ url }, "ClickHouse connected");
  } catch (err) {
    app.log.warn({ err, url }, "[clickhouse] ping failed — degraded mode");
  }

  const skipDDL = String(cfg.CLICKHOUSE_SKIP_DDL ?? "true").toLowerCase() === "true";
  if (!skipDDL) {
    const db = database || "default";
    setTimeout(async () => {
      try {
        await client.exec({
          query: `
            CREATE TABLE IF NOT EXISTS ${db}.${table}
            (
              ts         DateTime                  DEFAULT now(),
              date       Date                      DEFAULT toDate(ts),
              hour       UInt8                     DEFAULT toHour(ts),
              event      String,
              adapter    String,
              adUnitCode String,
              bidder     String,
              creativeId String,
              cpm        Float64                   DEFAULT 0,
              cur        LowCardinality(String)    DEFAULT 'USD',
              uid        String                    DEFAULT '',
              sid        String                    DEFAULT '',
              page       String                    DEFAULT '',
              ref        String                    DEFAULT '',
              adomain    Array(String)             DEFAULT []
            )
            ENGINE = MergeTree
            ORDER BY (date, hour, event, adapter, adUnitCode, bidder, creativeId)
          `,
        });
        app.log.info(`[clickhouse] DDL ensured (${db}.${table})`);
      } catch (e) {
        app.log.warn({ err: e }, "[clickhouse] DDL skipped/failed");
      }
    }, 0);
  }
};

export default fp(plugin, { name: "clickhouse" });
