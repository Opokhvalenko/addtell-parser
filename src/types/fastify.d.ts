import "fastify";
import type { PrismaClient } from "@prisma/client";
import type { CronStatus } from "../cron/types";

declare module "fastify" {
  interface FastifyInstance {
    config: {
      NODE_ENV?: "development" | "test" | "production";
      LOG_LEVEL?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
      HOST?: string;
      PORT: number;
      TRUST_PROXY?: number | boolean | string;

      JWT_SECRET: string;
      COOKIE_SECRET: string;
      /** for local HTTP in docker: set to "false" */
      COOKIE_SECURE?: "true" | "false";

      APP_ORIGIN?: string;
      CORS_ORIGINS?: string;

      ADMIN_TOKEN?: string;
      UPLOADS_DIR: string;
      DEFAULT_FEED_URL?: string;
      DATABASE_URL: string;
    };

    prisma: PrismaClient;
    pluginLoaded?(pluginName: string): void;
    cronFeedsRun?(onlyUrl?: string): Promise<void>;
    cronFeedsStatus?(): CronStatus;
  }

  interface FastifyRequest {
    cookies: Record<string, string | undefined>;
    uid?: string;
    user?: { id: string; email?: string };
  }
}
