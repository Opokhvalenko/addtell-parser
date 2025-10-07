import { performance } from "node:perf_hooks";
import {
  context,
  type Context as OtelContext,
  type Span,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import {
  createCustomTrace,
  initializeTelemetry,
  logWithContext,
  recordRequest,
} from "../telemetry/index.js";

type ReqWithOtel = FastifyRequest & { __span?: Span; __t0?: number; __ctx?: OtelContext };

function getRoute(req: FastifyRequest): string {
  const r = req as FastifyRequest & {
    routeOptions?: { url?: string };
    routerPath?: string;
  };
  return r.routeOptions?.url ?? r.routerPath ?? req.url;
}

export default fp(
  async (app: FastifyInstance) => {
    initializeTelemetry();

    app.addHook("onRequest", async (req: ReqWithOtel) => {
      req.__t0 = performance.now();
      const span = createCustomTrace("http_request", {
        "http.method": req.method,
        "http.target": req.url,
        user_agent: req.headers["user-agent"] ?? "unknown",
      }) as Span;
      req.__span = span;

      req.__ctx = trace.setSpan(context.active(), span);
    });

    app.addHook("onResponse", async (req: ReqWithOtel, reply: FastifyReply) => {
      const dur = req.__t0 ? performance.now() - req.__t0 : 0;
      const route = getRoute(req);

      recordRequest(req.method, route, reply.statusCode, dur);

      context.with(req.__ctx ?? context.active(), () => {
        logWithContext("info", "HTTP request completed", {
          method: req.method,
          url: req.url,
          route,
          status_code: reply.statusCode,
          duration_ms: Math.round(dur),
          user_agent: req.headers["user-agent"],
        });
      });

      if (req.__span) {
        req.__span.setAttributes({
          "http.status_code": reply.statusCode,
          "http.response_time_ms": Math.round(dur),
          "http.route": route,
        });
        req.__span.end();

        delete req.__span;
      }
      if (req.__ctx) delete req.__ctx;
    });

    app.addHook("onError", async (req: ReqWithOtel, _reply: FastifyReply, err: Error) => {
      context.with(req.__ctx ?? context.active(), () => {
        logWithContext("error", "HTTP request failed", {
          method: req.method,
          url: req.url,
          route: getRoute(req),
          error_message: err.message,
          error_stack: err.stack,
        });
      });

      if (req.__span) {
        req.__span.recordException(err);
        req.__span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        req.__span.end();
        delete req.__span;
      }
      if (req.__ctx) delete req.__ctx;
    });

    app.log.info("OpenTelemetry plugin registered");
  },
  { name: "otel" },
);
