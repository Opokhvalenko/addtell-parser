import { readFile } from "node:fs/promises";

export type TemplateName = "form" | "success";

/** Локальний кеш шаблонів у межах процесу/модуля без any */
const tplCache = new Map<string, string>();

/**
 * Рендер HTML-шаблону з плейсхолдерами {{key}}
 */
export async function renderTpl(
  name: TemplateName,
  data: Record<string, string> = {},
): Promise<string> {
  const url = new URL(`../templates/${name}.html`, import.meta.url);
  const key = url.pathname;

  let html = tplCache.get(key);
  if (!html) {
    html = await readFile(url, "utf8");
    tplCache.set(key, html);
  }

  return html.replace(/\{\{(\w+)\}\}/g, (_, k: string) => data[k] ?? "");
}
