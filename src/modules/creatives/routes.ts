import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Type } from "@sinclair/typebox";
import fp from "fastify-plugin";
import { ensureUploadsDir } from "../../utils/uploads.js";

const CreateCreativeSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 200 }),
  html: Type.String({ minLength: 1 }),
  width: Type.Number({ minimum: 1 }),
  height: Type.Number({ minimum: 1 }),
});

const routes = fp(async (app) => {
  app.post<{ Body: typeof CreateCreativeSchema }>(
    "/creatives",
    {
      preHandler: app.authenticate,
      schema: { body: CreateCreativeSchema },
    },
    async (req, reply) => {
      if (!req.user) return reply.unauthorized();

      const userId = (req.user as { id: string }).id;
      const { name, html, width, height } = req.body;

      const uploadsDir = await ensureUploadsDir(app);

      const filename = `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.html`;
      const filePath = join(uploadsDir, filename);

      await writeFile(filePath, html, "utf8");

      const creative = await app.prisma.creative.create({
        data: {
          ownerId: userId,
          filename,
          url: `/uploads/creatives/${filename}`,
          mime: "text/html",
          html,
          width,
          height,
        },
        select: { id: true, url: true, filename: true, mime: true },
      });

      return reply.code(201).send(creative);
    },
  );
});

export default routes;
