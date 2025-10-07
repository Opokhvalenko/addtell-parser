import assert from "node:assert";
import { describe, test } from "node:test";

describe("Utils Tests", () => {
  test("Time Utils - should format date correctly", async () => {
    const { formatDate } = await import("../src/lib/time");

    const date = new Date("2024-01-15T10:30:00Z");
    const formatted = formatDate(date);

    assert.ok(formatted);
    assert.ok(typeof formatted === "string");
  });

  test("Time Utils - should parse date correctly", async () => {
    const { parseDate } = await import("../src/lib/time");

    const dateString = "2024-01-15";
    const parsed = parseDate(dateString);

    assert.ok(parsed instanceof Date);
    assert.strictEqual(parsed.getFullYear(), 2024);
    assert.strictEqual(parsed.getMonth(), 0); // January
    assert.strictEqual(parsed.getDate(), 15);
  });

  test("Time Utils - should calculate time difference", async () => {
    const { timeDiff } = await import("../src/lib/time");

    const start = new Date("2024-01-15T10:00:00Z");
    const end = new Date("2024-01-15T10:05:00Z");
    const diff = timeDiff(start, end);

    assert.strictEqual(diff, 300000); // 5 minutes in milliseconds
  });

  test("Parse List Utils - should parse comma-separated values", async () => {
    const { parseList } = await import("../src/lib/parseList");

    const csv = "item1,item2,item3";
    const parsed = parseList(csv);

    assert.strictEqual(parsed.length, 3);
    assert.strictEqual(parsed[0], "item1");
    assert.strictEqual(parsed[1], "item2");
    assert.strictEqual(parsed[2], "item3");
  });

  test("Parse List Utils - should parse JSON array", async () => {
    const { parseList } = await import("../src/lib/parseList");

    const json = '["item1", "item2", "item3"]';
    const parsed = parseList(json);

    assert.strictEqual(parsed.length, 3);
    assert.strictEqual(parsed[0], "item1");
    assert.strictEqual(parsed[1], "item2");
    assert.strictEqual(parsed[2], "item3");
  });

  test("Parse List Utils - should handle single item", async () => {
    const { parseList } = await import("../src/lib/parseList");

    const single = "single-item";
    const parsed = parseList(single);

    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0], "single-item");
  });

  test("Parse List Utils - should handle empty input", async () => {
    const { parseList } = await import("../src/lib/parseList");

    const empty = "";
    const parsed = parseList(empty);

    assert.strictEqual(parsed.length, 0);
  });

  test("HTTP Error Utils - should create proper error objects", async () => {
    const { createHttpError, isHttpError } = await import("../src/lib/http");

    const error = createHttpError(404, "Not Found");

    assert.strictEqual((error as any).statusCode, 404);
    assert.strictEqual(error.message, "Not Found");
    assert.ok(isHttpError(error));
  });

  test("CN Utils - should combine class names", async () => {
    const { classNames } = await import("../src/lib/classNames");

    const result = classNames("class1", "class2", "class3");

    assert.strictEqual(result, "class1 class2 class3");
  });

  test("CN Utils - should handle conditional classes", async () => {
    const { classNames } = await import("../src/lib/classNames");

    const result = classNames("base", true && "conditional", false && "hidden");

    assert.strictEqual(result, "base conditional");
  });

  test("CN Utils - should filter out falsy values", async () => {
    const { classNames } = await import("../src/lib/classNames");

    const result = classNames("base", null, undefined, "", "valid");

    assert.strictEqual(result, "base valid");
  });

  test("Zustand Utils - should create store correctly", async () => {
    const { createZustandStore } = await import("../src/lib/zustand");

    const store = createZustandStore({ count: 0 });

    assert.strictEqual(store.state.count, 0);

    const newState = store.setState({ count: 1 });
    assert.strictEqual(newState.count, 1);
  });

  test("Query Utils - should build query string", async () => {
    const { buildQueryString } = await import("../src/lib/queryString");

    const params = { page: 1, limit: 10, search: "test" };
    const queryString = buildQueryString(params);

    assert.ok(queryString.includes("page=1"));
    assert.ok(queryString.includes("limit=10"));
    assert.ok(queryString.includes("search=test"));
  });

  test("API Utils - should create API client", async () => {
    const { ApiClient } = await import("../src/lib/apiClient");

    const client = new ApiClient("http://localhost:3000");

    assert.ok(client.get);
    assert.ok(client.post);
  });

  test("Cookies Utils - should parse cookies", async () => {
    const { parseCookies } = await import("../src/lib/cookies");

    const cookieString = "token=abc123; session=xyz789; theme=dark";
    const parsed = parseCookies(cookieString);

    assert.strictEqual(parsed.token, "abc123");
    assert.strictEqual(parsed.session, "xyz789");
    assert.strictEqual(parsed.theme, "dark");
  });

  test("Cookies Utils - should serialize cookies", async () => {
    const { setCookie } = await import("../src/lib/cookies");

    const cookie = setCookie("token", "abc123", { maxAge: 3600 });

    assert.ok(cookie.includes("token=abc123"));
    assert.ok(cookie.includes("Max-Age=3600"));
  });
});
