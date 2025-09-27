/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

const FEEDS_URL = process.env.FEEDS_URL || "https://prebid.pokhvalenko.ua/api/feeds";
const OUT = path.resolve(process.cwd(), process.env.FEEDS_OUT || "public/ads/feeds.json");
const SCHEDULE = process.env.CRON_FEEDS_SCHEDULE || "*/10 * * * *";
const TZ = process.env.CRON_TZ || "UTC";

async function run() {
  const res = await fetch(FEEDS_URL);
  const json = await res.json();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(json, null, 2));
  console.log("[feeds] updated", new Date().toISOString(), "->", OUT);
}

cron.schedule(SCHEDULE, run, { timezone: TZ });
run();
