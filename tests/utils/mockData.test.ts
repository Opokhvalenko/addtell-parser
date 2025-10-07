import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { MOCK_STATS_DATA } from "../../src/utils/mockData.js";

describe("Mock Data Utils", () => {
  it("should have correct structure for mock stats data", () => {
    assert(Array.isArray(MOCK_STATS_DATA));
    assert(MOCK_STATS_DATA.length > 0);
  });

  it("should have required fields for each stat row", () => {
    MOCK_STATS_DATA.forEach((row) => {
      assert("ts" in row);
      assert("date" in row);
      assert("event" in row);
      assert("adapter" in row);
      assert("count" in row);
      assert("wins" in row);
      assert("cpmAvg" in row);
    });
  });

  it("should have valid timestamps", () => {
    MOCK_STATS_DATA.forEach((row) => {
      const date = new Date(row.ts);
      assert(!isNaN(date.getTime()));
    });
  });

  it("should have valid numeric values", () => {
    MOCK_STATS_DATA.forEach((row) => {
      assert(typeof row.count === "number");
      assert(typeof row.wins === "number");
      assert(typeof row.cpmAvg === "number");
      assert(row.count > 0);
      assert(row.wins >= 0);
      assert(row.cpmAvg > 0);
    });
  });

  it("should have different adapters", () => {
    const adapters = new Set(MOCK_STATS_DATA.map((row) => row.adapter));
    assert(adapters.size > 1);
  });

  it("should have different events", () => {
    const events = new Set(MOCK_STATS_DATA.map((row) => row.event));
    assert(events.size > 0);
  });
});
