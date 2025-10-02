import type { FastifyInstance } from "fastify";

export type CreateArgs = {
  ownerId: string;
  name: string;
  sizes: string[];
  adType: "banner" | "video" | "native";
  geo?: string[];
  minCpm?: number;
  maxCpm?: number;
  frequencyPerDay?: number;
  creativeId: string;
  clickUrl?: string;
  html?: string;
};

export async function createLineItem(app: FastifyInstance, args: CreateArgs) {
  const min = typeof args.minCpm === "number" ? args.minCpm : null;
  const max = typeof args.maxCpm === "number" ? args.maxCpm : null;
  if (min !== null && max !== null && max < min) {
    throw app.httpErrors.badRequest("cpmMax must be >= cpmMin");
  }

  const sizes = args.sizes.map((s) => String(s).trim().toLowerCase());
  const geo = (args.geo ?? []).map((s) => s.trim().toUpperCase()).filter(Boolean);

  return app.prisma.lineItem.create({
    data: {
      ownerId: args.ownerId,
      name: args.name,
      sizes,
      adType: args.adType,
      geo,
      minCpm: min,
      maxCpm: max,
      frequencyPerDay: typeof args.frequencyPerDay === "number" ? args.frequencyPerDay : null,
      creativeId: args.creativeId,
      active: true,
    },
    select: { id: true },
  });
}
