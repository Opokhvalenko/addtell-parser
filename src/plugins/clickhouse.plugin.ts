import { type ClickHouseClient, createClient } from "@clickhouse/client";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

// тип для FastifyInstance (у .d.ts — див. крок 1)
// тут нічого додатково не оголошуємо

const plugin: FastifyPluginAsync = async (app) => {
  // беремо значення з типізованого app.config
  const {
    CLICKHOUSE_URL: url,
    CLICKHOUSE_USER: username,
    CLICKHOUSE_PASSWORD: password,
    CLICKHOUSE_DB: database,
  } = app.config;

  const ch: ClickHouseClient = createClient({
    url,
    username,
    password,
    database,
    request_timeout: 1500,
  });

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
    await ch.close().catch(() => {});
  }
};

export default fp(plugin, { name: "clickhouse" });
