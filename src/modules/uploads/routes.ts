import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import "@fastify/multipart";
import type { MultipartFile } from "@fastify/multipart";
import { type SaveCreativeResult, saveCreativeFromMultipart } from "./service.js";

function hasFileMethod(
  r: FastifyRequest,
): r is FastifyRequest & { file: () => Promise<MultipartFile | undefined> } {
  return typeof (r as { file?: unknown }).file === "function";
}

type UploadReply = {
  url: string;
  filename: string;
  mime: string | null;
  creativeId: string;
};

const routes: FastifyPluginAsync = async (app) => {
  app.post<{ Reply: UploadReply }>(
    "/upload",
    { preHandler: app.authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.user) return reply.unauthorized("Login required");

      let file: MultipartFile | undefined;
      if (hasFileMethod(req)) {
        file = await req.file();
      }

      if (!file && req.body && typeof req.body === "object") {
        for (const v of Object.values(req.body as Record<string, unknown>)) {
          if (
            typeof v === "object" &&
            v !== null &&
            typeof (v as { toBuffer?: unknown }).toBuffer === "function"
          ) {
            file = v as MultipartFile;
            break;
          }
        }
      }

      if (!file) throw app.httpErrors.badRequest("No file field found");

      const result: SaveCreativeResult = await saveCreativeFromMultipart(app, {
        ownerId: req.user.id,
        file,
      });

      reply.code(201);
      return {
        url: result.url,
        filename: result.filename,
        mime: result.mime,
        creativeId: result.id,
      };
    },
  );
};

export default routes;
