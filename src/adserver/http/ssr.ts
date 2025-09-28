import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "./auth.js";

const PAGE = (opts: { adminToken?: string }) => `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Create Line Item</title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 text-gray-900">
  <div class="max-w-3xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-4">Створення Line Item</h1>
    <div id="shadow-host" class="rounded-xl border bg-white p-4 shadow"></div>
  </div>
  <script>
    (function(){
      const host = document.getElementById('shadow-host');
      const root = host.attachShadow({ mode: 'open' });
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css';
      const wrap = document.createElement('div');
      wrap.innerHTML = \`
        <form id="f" class="grid" enctype="multipart/form-data" method="post" action="/admin/ads/lineitems">
          <label>Назва <input name="name" required /></label>
          <label>Розміри (CSV: 300x250,728x90) <input name="sizes" required /></label>
          <label>Тип реклами
            <select name="adType"><option>banner</option></select>
          </label>
          <label>Гео allowlist (CSV, опц.) <input name="geo" /></label>
          <div class="grid" style="grid-template-columns:1fr 1fr; gap:12px;">
            <label>Min CPM <input name="minCpm" type="number" step="0.01" /></label>
            <label>Max CPM <input name="maxCpm" type="number" step="0.01" /></label>
          </div>
          <label>Частота показів/день <input name="frequencyPerDay" type="number" min="0" value="0" /></label>
          <label>Click URL <input name="clickUrl" placeholder="https://..." /></label>
          <label>Markdown (опц.) <textarea name="markdown" rows="4" placeholder="**Текст** і ![alt](/uploads/..)" ></textarea></label>
          <label>Creative файл (image/html) <input name="creative" type="file" required /></label>
          <input type="hidden" name="__admin_token" value="${opts.adminToken || ""}" />
          <button class="contrast" type="submit">Створити</button>
        </form>\`;
      root.appendChild(css);
      root.appendChild(wrap);
    })();
  </script>
</body></html>`;

const plugin: FastifyPluginAsync = async (app) => {
  app.get("/pages/create-lineitem", { preHandler: requireAuth }, async (_req, reply) => {
    const t = process.env.ADMIN_TOKEN;
    reply.type("text/html").send(t ? PAGE({ adminToken: t }) : PAGE({}));
  });
};

export default plugin;
