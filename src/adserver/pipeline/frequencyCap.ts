import type { FastifyInstance } from "fastify";

export async function passFrequencyCap(
  app: FastifyInstance,
  uid: string,
  li: { id: string; frequencyPerDay: number | null | undefined },
) {
  const hours = Number(process.env.FREQUENCY_WINDOW_HOURS || 24);
  const since = new Date(Date.now() - hours * 3600 * 1000);
  const limit = li.frequencyPerDay ?? 0;
  if (limit <= 0) return true;

  const used = await app.prisma.impression.count({
    where: { uid, lineItemId: li.id, at: { gte: since } },
  });
  return used < limit;
}
