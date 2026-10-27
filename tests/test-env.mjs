/**
 * Loaded before every test file (`tsx --import`). Fills in a local test database and dummy
 * secrets, but never overrides variables that are already set — `createTestApp` then refuses to
 * run against anything that is not a local database.
 */
/** @type {Record<string, string>} */
const TEST_DEFAULTS = {
  NODE_ENV: "test",
  DATABASE_URL: "mongodb://localhost:27019/adtell_test?replicaSet=rs0&directConnection=true",
  JWT_SECRET: "test-jwt-secret-that-is-at-least-32-chars",
  COOKIE_SECRET: "test-cookie-secret-that-is-at-least-32-chars",
  APP_ORIGIN: "http://localhost:5173",
  CLICKHOUSE_ENABLE: "false",
  CRON_ENABLE: "false",
  LOG_LEVEL: "silent",
  OTEL_SDK_DISABLED: "true",
  // Suites register many users from one address; the limit itself has its own test
  AUTH_RATE_LIMIT_MAX: "1000",
};

for (const [key, value] of Object.entries(TEST_DEFAULTS)) {
  process.env[key] ??= value;
}
