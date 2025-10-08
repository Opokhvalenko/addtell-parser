import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

interface AuditEvent {
  timestamp: string;
  event: string;
  userId?: string;
  ip: string;
  userAgent: string;
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  suspicious?: boolean;
  riskLevel: "low" | "medium" | "high";
}

export default fp(
  async (app) => {
    function assessRisk(event: Partial<AuditEvent>): "low" | "medium" | "high" {
      let riskScore = 0;

      const suspiciousIPs = ["127.0.0.1", "::1"];
      if (suspiciousIPs.includes(event.ip || "")) riskScore += 1;

      const suspiciousUserAgents = ["curl", "wget", "python", "bot", "spider", "crawler"];
      if (suspiciousUserAgents.some((ua) => (event.userAgent || "").toLowerCase().includes(ua))) {
        riskScore += 2;
      }

      const suspiciousPatterns = [/\.\./, /<script/i, /union.*select/i, /javascript:/i, /eval\(/i];
      if (suspiciousPatterns.some((p) => p.test(event.url || ""))) riskScore += 3;

      if ((event.responseTime || 0) < 10) riskScore += 1;
      if ((event.requestSize || 0) > 1024 * 1024) riskScore += 2;
      if ((event.statusCode || 0) >= 500) riskScore += 1;
      if ((event.statusCode || 0) >= 400 && (event.statusCode || 0) < 500) riskScore += 1;

      if (riskScore >= 5) return "high";
      if (riskScore >= 3) return "medium";
      return "low";
    }

    function logAuditEvent(event: AuditEvent) {
      const level: "warn" | "info" | "debug" =
        event.riskLevel === "high" ? "warn" : event.riskLevel === "medium" ? "info" : "debug";

      app.log[level]({ audit: true, ...event }, `Audit: ${event.event}`);

      if (event.riskLevel === "high") {
        app.log.error(
          { audit: true, security: true, ...event },
          "SECURITY ALERT: High risk activity detected",
        );
      }
    }

    app.addHook("onRequest", async (request: FastifyRequest) => {
      request.auditStartTime = Date.now();
      request.auditIP = request.ip;
      request.auditUserAgent = request.headers["user-agent"] || "unknown";
    });

    function parseContentLength(val: unknown): number {
      if (typeof val === "string") return parseInt(val, 10) || 0;
      if (Array.isArray(val) && val.length > 0) return parseInt(String(val[0]), 10) || 0;
      if (typeof val === "number") return val;
      return 0;
    }

    app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = request.auditStartTime;
      if (!startTime) return;

      const responseTime = Date.now() - startTime;
      const statusCode = reply.statusCode;
      const method = request.method;
      const url = request.url;

      const requestSize = parseContentLength(request.headers["content-length"]);
      const responseSize = parseContentLength(reply.getHeader("content-length"));

      const auditEvent: AuditEvent = {
        timestamp: new Date().toISOString(),
        event: url.startsWith("/auth")
          ? "auth_request"
          : url.startsWith("/analytics")
            ? "analytics_request"
            : url.startsWith("/stats")
              ? "stats_request"
              : url.startsWith("/adserver")
                ? "adserver_request"
                : "api_request",
        userId: request.user?.id,
        ip: request.auditIP || "unknown",
        userAgent: request.auditUserAgent || "unknown",
        method,
        url,
        statusCode,
        responseTime,
        requestSize,
        responseSize,
        riskLevel: "low",
      };

      auditEvent.riskLevel = assessRisk(auditEvent);
      auditEvent.suspicious = auditEvent.riskLevel !== "low";

      logAuditEvent(auditEvent);
    });

    app.addHook("onError", async (request: FastifyRequest, reply: FastifyReply, _error: Error) => {
      const auditEvent: AuditEvent = {
        timestamp: new Date().toISOString(),
        event: "error",
        userId: request.user?.id,
        ip: request.auditIP || request.ip || "unknown",
        userAgent: request.auditUserAgent || request.headers["user-agent"] || "unknown",
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode || 500,
        responseTime: 0,
        requestSize: 0,
        responseSize: 0,
        suspicious: true,
        riskLevel: "high",
      };
      logAuditEvent(auditEvent);
    });

    app.get(
      "/admin/audit",
      {
        preHandler: app.authenticate,
        schema: {
          querystring: {
            type: "object",
            properties: {
              limit: { type: "number", default: 100 },
              offset: { type: "number", default: 0 },
              riskLevel: { type: "string", enum: ["low", "medium", "high"] },
              event: { type: "string" },
              ip: { type: "string" },
            },
          },
        },
      },
      async (request) => ({
        message: "Audit logs endpoint - implementation needed",
        query: request.query,
      }),
    );

    app.log.info("Audit logging plugin registered");
  },
  { name: "audit-logging" },
);
