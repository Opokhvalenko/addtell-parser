import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function loadTemplate(): string {
  const here = fileURLToPath(import.meta.url);
  const distTpl = path.resolve(path.dirname(here), "../templates/create-lineitem.html");
  if (existsSync(distTpl)) return readFileSync(distTpl, "utf8");

  const srcTpl = path.resolve(
    process.cwd(),
    "src/modules/adserver/ssr/templates/create-lineitem.html",
  );
  if (existsSync(srcTpl)) return readFileSync(srcTpl, "utf8");

  throw new Error(`Template not found:\n- ${distTpl}\n- ${srcTpl}`);
}
const BASE_HTML = loadTemplate();

export function renderCreateLineItem({ user }: { user: { email: string } }) {
  return BASE_HTML.replaceAll("%%USER_EMAIL%%", escapeHtml(user.email));
}
