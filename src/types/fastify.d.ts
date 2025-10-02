import type { Config } from "../config/schema";
import type { PrismaClient } from "@prisma/client";
import type { CronStatus } from "../cron/types";

declare module "fastify" {
  interface FastifyInstance {
    // спільні поля
    config: Config;
    prisma: PrismaClient;
    pluginLoaded?(pluginName: string): void;

    // cron API — без дублювання полів
    cronFeedsRun(onlyUrl?: string): Promise<void>;
    cronFeedsStatus(): CronStatus;
  }
}
