import { type ClickHouseClient, createClient } from "@clickhouse/client";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    clickhouse?: ClickHouseClient;
  }
}

export default fp(
  async (app) => {
    const url = process.env.CLICKHOUSE_URL ?? "http://clickhouse:8123";
    const username = process.env.CLICKHOUSE_USER ?? "default";
    const password = process.env.CLICKHOUSE_PASSWORD ?? "mypassword";
    const database = process.env.CLICKHOUSE_DB ?? "mydb";

    const ch = createClient({ url, username, password, database, request_timeout: 1500 });
    try {
      await ch.ping();
      app.decorate("clickhouse", ch);
      await ch.exec({ query: `CREATE DATABASE IF NOT EXISTS ${database}` });
      await ch.exec({
        query: `
        CREATE TABLE IF NOT EXISTS ${database}.events
        (
          ts         DateTime        DEFAULT now(),
          date       Date            DEFAULT toDate(ts),
          hour       UInt8           DEFAULT toHour(ts),
          event      String,
          adapter    String,
          adUnitCode String,
          bidder     String,
          creativeId String,
          cpm        Float64         DEFAULT 0,
          cur        LowCardinality(String) DEFAULT 'USD',
          uid        String          DEFAULT '',
          sid        String          DEFAULT '',
          page       String          DEFAULT '',
          ref        String          DEFAULT '',
          adomain    Array(String)   DEFAULT []
        )
        ENGINE = MergeTree
        ORDER BY (date, hour, event, adapter, adUnitCode, bidder, creativeId)
      `,
      });
      app.addHook("onClose", async () => ch.close());
      app.log.info({ url }, "ClickHouse connected");
    } catch (err) {
      app.log.warn({ err, url }, "ClickHouse unavailable — running without it");
      try {
        await ch.close();
      } catch {
        /* ignore */
      }
    }
  },
  { name: "clickhouse.plugin" },
);
