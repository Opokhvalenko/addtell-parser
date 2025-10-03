import type { FastifyInstance } from "fastify";
import { createReporter } from "./report.service.js";
import type { BaseEvent } from "./types.js";

function toArrayBody(body: unknown): BaseEvent[] {
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body) as unknown;
      return Array.isArray(parsed) ? (parsed as BaseEvent[]) : [parsed as BaseEvent];
    } catch {
      throw Object.assign(new Error("invalid_json"), { statusCode: 400 as const });
    }
  }
  if (Array.isArray(body)) return body as BaseEvent[];
  if (body && typeof body === "object") return [body as BaseEvent];
  throw Object.assign(new Error("invalid_body"), { statusCode: 400 as const });
}

export default async function routes(app: FastifyInstance) {
  const reporter = createReporter(app);

  app.post<{ Body: BaseEvent | BaseEvent[] | string }>(
    "/report",
    {
      bodyLimit: 512 * 1024,
      schema: {
        body: {
          oneOf: [
            { type: "object", properties: { event: { type: "string" } }, required: ["event"] },
            {
              type: "array",
              items: {
                type: "object",
                properties: { event: { type: "string" } },
                required: ["event"],
              },
            },
            { type: "string" },
          ],
        },
      },
    },
    async (req, reply) => {
      try {
        const list = toArrayBody(req.body);
        await reporter.enqueue(list);
        app.metrics?.ingestCounter.inc({ source: "api" }, list.length);
        return reply.code(202).send({ ok: true });
      } catch (err) {
        const code =
          typeof (err as { statusCode?: number } | undefined)?.statusCode === "number"
            ? (err as { statusCode: number }).statusCode
            : 500;
        app.log.error({ err }, "ingest failed");
        return reply.code(code).send({ error: "ingest_failed", message: (err as Error).message });
      }
    },
  );
}
