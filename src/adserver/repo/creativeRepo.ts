import type { FastifyInstance } from "fastify";

export function creativeRepo(app: FastifyInstance) {
  return {
    create: (data: {
      url: string;
      mime?: string | null;
      width: number;
      height: number;
      html?: string | null;
    }) => app.prisma.creative.create({ data }),
  };
}
