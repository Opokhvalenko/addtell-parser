import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { exportConfigured } from "../src/telemetry/minimal.js";

describe("OpenTelemetry export switch", () => {
  test("nothing is exported on a host without OTEL settings", () => {
    assert.equal(exportConfigured({}), false);
  });

  test("a collector endpoint or an explicit exporter turns the export on", () => {
    assert.equal(
      exportConfigured({ OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example:4318" }),
      true,
    );
    assert.equal(exportConfigured({ OTEL_TRACES_EXPORTER: "console" }), true);
  });

  test('"none" and blank values switch signals off rather than asking for an export', () => {
    assert.equal(
      exportConfigured({
        OTEL_TRACES_EXPORTER: "none",
        OTEL_METRICS_EXPORTER: " NONE ",
        OTEL_LOGS_EXPORTER: "  ",
        OTEL_EXPORTER_OTLP_ENDPOINT: "",
      }),
      false,
    );
  });
});
