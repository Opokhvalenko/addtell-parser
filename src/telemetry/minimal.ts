import { metrics, trace } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { defaultResource, resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | null = null;

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? "adtell-backend";
const SERVICE_VERSION = process.env.npm_package_version ?? "1.0.0";
const ENV = process.env.NODE_ENV ?? "development";

const meter = metrics.getMeter(SERVICE_NAME, SERVICE_VERSION);

const requestCounter = meter.createCounter("http_requests_total", {
  description: "Total number of HTTP requests",
});
const requestDuration = meter.createHistogram("http_request_duration_ms", {
  description: "Duration of HTTP requests in milliseconds",
});
const dbOperationsCounter = meter.createCounter("db_operations_total", {
  description: "Total number of database operations",
});
const dbOperationDuration = meter.createHistogram("db_operation_duration_ms", {
  description: "Duration of database operations in milliseconds",
});
const fileOperationsCounter = meter.createCounter("file_operations_total", {
  description: "Total number of file system operations",
});
const memoryUsage = meter.createUpDownCounter("memory_usage_bytes", {
  description: "Memory usage in bytes",
});

const logger = logs.getLogger(SERVICE_NAME, SERVICE_VERSION);

const MEMORY_SAMPLE_INTERVAL_MS = 10_000;

/**
 * Where telemetry goes is set with the standard variables: a collector
 * (`OTEL_EXPORTER_OTLP_ENDPOINT`) or explicit exporters (`OTEL_TRACES_EXPORTER=console` etc. for
 * local debugging), which the SDK reads itself. With none of them nothing starts: console
 * exporters on a host such as Render only flood its logs with every span and a metrics dump
 * every few seconds.
 */
const EXPORTER_SETTINGS = ["OTEL_TRACES_EXPORTER", "OTEL_METRICS_EXPORTER", "OTEL_LOGS_EXPORTER"];
const NO_EXPORTER = "none";

export function exportConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  if ((env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "").trim() !== "") return true;
  // "none" switches a signal off; it does not ask for an export
  return EXPORTER_SETTINGS.some((name) => {
    const value = (env[name] ?? "").trim().toLowerCase();
    return value !== "" && value !== NO_EXPORTER;
  });
}

export function initializeTelemetry(): void {
  // Standard OpenTelemetry switch; tests set it so exporters and timers do not keep the process alive
  if (process.env.OTEL_SDK_DISABLED === "true" || !exportConfigured()) return;
  if (sdk) return;

  const resource = defaultResource().merge(
    resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
      [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: ENV,
    }),
  );

  const instrumentations = [
    getNodeAutoInstrumentations({
      // A span per file read or write is noise, not insight, for this service
      "@opentelemetry/instrumentation-fs": { enabled: false },
      "@opentelemetry/instrumentation-http": { enabled: true },
      "@opentelemetry/instrumentation-fastify": { enabled: true },
      "@opentelemetry/instrumentation-mongodb": { enabled: true },
      "@opentelemetry/instrumentation-pino": { enabled: true },
    }),
  ];

  // Exporters, metric reader and log processor come from the OTEL_* variables
  sdk = new NodeSDK({ resource, instrumentations });
  sdk.start();

  logger.emit({
    severityNumber: SeverityNumber.INFO,
    body: "OpenTelemetry initialized",
    attributes: { service: SERVICE_NAME, version: SERVICE_VERSION, env: ENV },
  });

  startMemoryMonitoring();
}

function startMemoryMonitoring(): void {
  setInterval(() => {
    const m = process.memoryUsage();
    memoryUsage.add(m.heapUsed, { type: "heap_used" });
    memoryUsage.add(m.heapTotal, { type: "heap_total" });
    memoryUsage.add(m.rss, { type: "rss" });
    memoryUsage.add(m.external, { type: "external" });
  }, MEMORY_SAMPLE_INTERVAL_MS).unref();
}

export function recordRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
) {
  requestCounter.add(1, { method, path, status_code: String(statusCode) });
  requestDuration.record(durationMs, { method, path, status_code: String(statusCode) });
}

export function recordDbOperation(
  operation: string,
  collection: string,
  durationMs: number,
  success: boolean,
) {
  dbOperationsCounter.add(1, { operation, collection, success: String(success) });
  dbOperationDuration.record(durationMs, { operation, collection, success: String(success) });
}

export function recordFileOperation(operation: string, path: string, success: boolean) {
  fileOperationsCounter.add(1, { operation, path: path.slice(0, 100), success: String(success) });
}

export function createCustomTrace(
  name: string,
  attributes?: Record<string, string | number | boolean>,
) {
  const tracer = trace.getTracer(SERVICE_NAME, SERVICE_VERSION);
  const span = tracer.startSpan(name);
  if (attributes) span.setAttributes(attributes);
  return span;
}

export function logWithContext(
  level: "info" | "warn" | "error",
  message: string,
  attributes?: Record<string, unknown>,
) {
  const map: Record<string, SeverityNumber> = {
    info: SeverityNumber.INFO,
    warn: SeverityNumber.WARN,
    error: SeverityNumber.ERROR,
  };
  logger.emit({
    severityNumber: map[level] ?? SeverityNumber.INFO,
    body: message,
    attributes: { service: SERVICE_NAME, ts: new Date().toISOString(), ...attributes },
  });
}

export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) return;
  try {
    logger.emit({
      severityNumber: SeverityNumber.INFO,
      body: "Shutting down OpenTelemetry SDK",
      attributes: { service: SERVICE_NAME, ts: new Date().toISOString() },
    });
    await sdk.shutdown();
  } finally {
    sdk = null;
  }
}

process.once("SIGTERM", () => void shutdownTelemetry());
process.once("SIGINT", () => void shutdownTelemetry());

initializeTelemetry();
