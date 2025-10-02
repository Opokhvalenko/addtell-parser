import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyPluginAsync } from "fastify";

const __dirname = dirname(fileURLToPath(import.meta.url));

let htmlCache: string | null = null;
async function loadHtml(): Promise<string> {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && htmlCache) return htmlCache;
  const p = join(__dirname, "templates", "create-lineitem.html");
  const html = await readFile(p, "utf8");
  if (isProd) htmlCache = html;
  return html;
}

const pagesRoutes: FastifyPluginAsync = async (app) => {
  app.log.info("pages: routes loaded");

  app.get("/create-lineitem", { preHandler: app.authenticate }, async (_req, reply) => {
    const html = await loadHtml();
    return reply.type("text/html").send(html);
  });
};

export default pagesRoutes;
