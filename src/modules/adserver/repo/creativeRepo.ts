import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";

type CreateArgs = {
  ownerId: string;
  filename: string;
  url: string;
  mime: string;
  width?: number;
  height?: number;
  html?: string | null;
  meta?: Prisma.JsonValue;
};
export function creativeRepo(app: FastifyInstance) {
  return {
    create: (data: CreateArgs) =>
      app.prisma.creative.create({
        data: {
          ownerId: data.ownerId,
          filename: data.filename,
          url: data.url,
          mime: data.mime,
          ...(typeof data.width === "number" ? { width: data.width } : {}),
          ...(typeof data.height === "number" ? { height: data.height } : {}),
          ...(data.html !== undefined ? { html: data.html } : {}),
          ...(data.meta !== undefined ? { meta: data.meta } : {}),
        },
        select: {
          id: true,
          url: true,
          filename: true,
          mime: true,
          width: true,
          height: true,
          html: true,
          createdAt: true,
        },
      }),
  };
}
