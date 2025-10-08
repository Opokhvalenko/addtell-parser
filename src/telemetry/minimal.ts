import { metrics, trace } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { defaultResource, resourceFromAttributes } from "@opentelemetry/resources";
import { ConsoleLogRecordExporter, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { ConsoleMetricExporter, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
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

export function initializeTelemetry(): void {
  if (sdk) {
    console.warn("[otel] SDK already initialized");
    return;
  }

  const resource = defaultResource().merge(
    resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
      [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: ENV,
    }),
  );

  const traceExporter = new ConsoleSpanExporter();
  const metricReader = new PeriodicExportingMetricReader({
    exporter: new ConsoleMetricExporter(),
    exportIntervalMillis: Number(process.env.OTEL_METRIC_INTERVAL_MS ?? 5000),
  });
  const logRecordProcessor = new SimpleLogRecordProcessor(new ConsoleLogRecordExporter());

  const instrumentations = [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": { enabled: true },
      "@opentelemetry/instrumentation-http": { enabled: true },
      "@opentelemetry/instrumentation-fastify": { enabled: true },
      "@opentelemetry/instrumentation-mongodb": { enabled: true },
      "@opentelemetry/instrumentation-pino": { enabled: true },
      // "@opentelemetry/instrumentation-redis-4": { enabled: true },
      // "@opentelemetry/instrumentation-ioredis": { enabled: true },
      // "@opentelemetry/instrumentation-undici": { enabled: true },
      // "@prisma/instrumentation": { enabled: true },
    }),
  ];

  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    logRecordProcessor,
    instrumentations,
  });

  sdk.start();

  logger.emit({
    severityNumber: SeverityNumber.INFO,
    body: "OpenTelemetry initialized",
    attributes: { service: SERVICE_NAME, version: SERVICE_VERSION, env: ENV },
  });

  startMemoryMonitoring();

  console.log("🚀 OpenTelemetry initialized successfully");
  console.log(
    "📊 Metrics will be exported every",
    Number(process.env.OTEL_METRIC_INTERVAL_MS ?? 5000),
    "ms",
  );
  console.log("📝 Logs and traces are being collected");
  console.log("🔧 Instrumentations: FS, MongoDB, Pino, HTTP");
}

function startMemoryMonitoring(): void {
  setInterval(() => {
    const m = process.memoryUsage();
    memoryUsage.add(m.heapUsed, { type: "heap_used" });
    memoryUsage.add(m.heapTotal, { type: "heap_total" });
    memoryUsage.add(m.rss, { type: "rss" });
    memoryUsage.add(m.external, { type: "external" });
  }, 10_000);
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
    await new Promise((r) => setTimeout(r, 500));
    await sdk.shutdown();
    console.log("🔌 OpenTelemetry shut down");
  } finally {
    sdk = null;
  }
}

process.once("SIGTERM", () => void shutdownTelemetry());
process.once("SIGINT", () => void shutdownTelemetry());

initializeTelemetry();
