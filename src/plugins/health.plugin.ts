import type { ClickHouseClient } from "@clickhouse/client";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

const TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS ?? 1500);

/* helpers */
function hasClickHouse(
  app: FastifyInstance,
): app is FastifyInstance & { clickhouse: ClickHouseClient } {
  const maybe = (app as unknown as { clickhouse?: unknown }).clickhouse;
  return !!maybe && typeof (maybe as { ping?: unknown }).ping === "function";
}

function errorToString(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS) {
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const t = setTimeout(() => resolve({ ok: false, error: `timeout ${ms}ms` }), ms);
    p.then(() => {
      clearTimeout(t);
      resolve({ ok: true });
    }).catch((e) => {
      clearTimeout(t);
      resolve({ ok: false, error: errorToString(e) });
    });
  });
}

function getPrisma(app: FastifyInstance): PrismaClient | undefined {
  const a = app as FastifyInstance & { prisma?: PrismaClient };
  return a.prisma;
}

// Mongo ($runCommandRaw) або SQL ($queryRaw)
async function probePrisma(app: FastifyInstance) {
  const prisma = getPrisma(app);
  if (!prisma) return { ok: false, error: "missing" };

  const candidate = prisma as unknown as {
    $runCommandRaw?: (cmd: unknown) => Promise<unknown>;
    $queryRaw?: TemplateStringsArray | ((...args: unknown[]) => Promise<unknown>);
  };

  if (typeof candidate.$runCommandRaw === "function") {
    return withTimeout(candidate.$runCommandRaw({ ping: 1 }));
  }
  if (typeof candidate.$queryRaw === "function") {
    // @ts-expect-error
    return withTimeout(prisma.$queryRaw`SELECT 1`);
  }
  return { ok: false, error: "unknown client" };
}

/* plugin */
export default fp(
  async (app) => {
    app.log.info("Health plugin registered");

    async function probe() {
      const checks: Record<string, { ok: boolean; error?: string }> = {};

      checks.db = await probePrisma(app);
      checks.clickhouse = hasClickHouse(app)
        ? await withTimeout(app.clickhouse.ping())
        : { ok: false, error: "missing" };

      const ok = Object.values(checks).every((c) => c.ok);
      const degraded = !ok && Object.values(checks).some((c) => c.ok);

      return {
        status: ok ? "ok" : degraded ? "degraded" : "down",
        checks,
        timestamp: new Date().toISOString(),
      };
    }

    const handler = async (_req: FastifyRequest, reply: FastifyReply) => {
      const res = await probe();
      reply.code(res.status === "down" ? 503 : 200).send(res);
    };

    const routeOpts = { config: { public: true, rateLimit: false } } as const;
    app.get("/health", routeOpts, handler);
    app.get("/api/health", routeOpts, handler);
  },
  { name: "health" },
);
