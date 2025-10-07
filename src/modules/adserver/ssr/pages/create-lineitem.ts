import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function loadTemplate(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const distTpl = resolve(here, "../templates/create-lineitem.html");
  if (existsSync(distTpl)) return readFileSync(distTpl, "utf8");
  const srcTpl = resolve(process.cwd(), "src/modules/adserver/ssr/templates/create-lineitem.html");
  if (existsSync(srcTpl)) return readFileSync(srcTpl, "utf8");
  return `<!doctype html>
<meta charset="utf-8">
<title>Create line item</title>
<h1>Create Line Item</h1>
<p>User: %%USER_EMAIL%%</p>`;
}

const BASE_HTML = loadTemplate();

export function renderCreateLineItem(opts?: { user?: { email?: string } }): string {
  const email = opts?.user?.email ?? "";
  return BASE_HTML.replaceAll("%%USER_EMAIL%%", escapeHtml(email));
}
