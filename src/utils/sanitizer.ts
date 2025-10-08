import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from "fastify";
import DOMPurify from "isomorphic-dompurify";

type DOMPurifyConfig = NonNullable<Parameters<typeof DOMPurify.sanitize>[1]>;

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "b",
    "i",
    "span",
    "div",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "a",
    "img",
  ],
  ALLOWED_ATTR: ["href", "title", "alt", "src", "width", "height", "class", "id", "style"],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  SANITIZE_DOM: true,
  KEEP_CONTENT: true,

  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,

  FORBID_TAGS: ["script", "object", "embed", "form", "input", "textarea"],
  FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover", "onfocus", "onblur"],
  ADD_ATTR: ["target"],
  ADD_TAGS: [],
} satisfies DOMPurifyConfig;

export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  try {
    return DOMPurify.sanitize(html, SANITIZE_CONFIG);
  } catch (_error) {
    console.error("HTML sanitization failed");
    return "";
  }
}

export function stripHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  try {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });
  } catch {
    return html.replace(/<[^>]*>/g, "");
  }
}

export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== "string") return "";
  try {
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) return "";
    const lower = url.toLowerCase();
    const forbidden = ["javascript:", "data:", "vbscript:", "file:", "ftp:"];
    if (forbidden.some((x) => lower.includes(x))) return "";
    return urlObj.toString();
  } catch {
    return "";
  }
}

export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== "string") return "";
  const trimmed = email.trim().toLowerCase();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(trimmed)) return "";
  if (/[<>'"&]/.test(trimmed)) return "";
  return trimmed;
}

export function sanitizeObject<T>(obj: T): T {
  if (obj == null) return obj;

  if (typeof obj === "string") {
    return sanitizeHtml(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return (obj as unknown[]).map((v) => sanitizeObject(v)) as unknown as T;
  }

  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const cleanKey = stripHtml(String(key)).trim();
      if (cleanKey) {
        out[cleanKey] = sanitizeObject(value);
      }
    }
    return out as unknown as T;
  }

  return obj;
}

export function sanitizeRequestBody(
  request: FastifyRequest,
  _reply: FastifyReply,
  next: HookHandlerDoneFunction,
) {
  if (request.body && typeof request.body === "object") {
    request.body = sanitizeObject(request.body as Record<string, unknown>) as unknown;
  }
  next();
}
