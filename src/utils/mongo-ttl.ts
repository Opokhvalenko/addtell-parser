import type { FastifyInstance } from "fastify";

type IndexInfo = { name: string; expireAfterSeconds?: number };
type ListIndexesResult = { cursor?: { firstBatch?: IndexInfo[] } };

/** MongoDB answers `listIndexes` on a collection that does not exist yet with this code. */
const NAMESPACE_NOT_FOUND = "NamespaceNotFound";

async function listIndexes(app: FastifyInstance, collection: string): Promise<IndexInfo[]> {
  try {
    const res = (await app.prisma.$runCommandRaw({ listIndexes: collection })) as ListIndexesResult;
    return res.cursor?.firstBatch ?? [];
  } catch (error) {
    // Prisma reports Mongo errors only as text (meta.code is "unknown")
    if (String((error as Error)?.message).includes(NAMESPACE_NOT_FOUND)) return [];
    throw error;
  }
}

/**
 * Makes MongoDB delete documents once `field` is older than `seconds`.
 * Prisma cannot declare TTL indexes, so this runs at startup; it is idempotent and also updates
 * the expiry when the configured retention changes.
 */
export async function ensureTtlIndex(
  app: FastifyInstance,
  collection: string,
  field: string,
  seconds: number,
): Promise<void> {
  const name = `${field}_ttl`;
  const expireAfterSeconds = Math.max(1, Math.round(seconds));
  const existing = (await listIndexes(app, collection)).find((index) => index.name === name);

  if (!existing) {
    await app.prisma.$runCommandRaw({
      createIndexes: collection,
      indexes: [{ key: { [field]: 1 }, name, expireAfterSeconds }],
    });
  } else if (existing.expireAfterSeconds !== expireAfterSeconds) {
    await app.prisma.$runCommandRaw({ collMod: collection, index: { name, expireAfterSeconds } });
  }
}
