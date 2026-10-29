import type { FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { ClickHouseClient } from "@clickhouse/client";
import type { Registry, Counter } from "prom-client";
import type { Config } from "../config/schema";
import type { createReporter } from "../modules/analytics/service";

declare module "fastify" {
  interface FastifyInstance {
    config: Config;
    clickhouse?: ClickHouseClient;
    analyticsReporter: ReturnType<typeof createReporter>;
    metrics?: {
      register: Registry;
      ingestCounter: Counter<string>;
    };
    prisma: PrismaClient;

    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

    httpErrors: {
      badRequest: (message: string) => Error;
      unauthorized: (message?: string) => Error;
      forbidden: (message?: string) => Error;
      notFound: (message?: string) => Error;
      conflict: (message?: string) => Error;
      payloadTooLarge: (message?: string) => Error;
      badGateway: (message: string) => Error;
      serviceUnavailable: (message?: string) => Error;
      internalServerError: (message?: string) => Error;
    };
  }

  interface FastifyContextConfig {
    public?: boolean;
  }

  interface FastifyRequest {
    cookies: Record<string, string | undefined>;
    uid?: string;
    user?: { id: string; email?: string };
  }
}
