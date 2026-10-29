import fp from "fastify-plugin";

const UPLOADS_CSP = "default-src 'none'; img-src 'self'; sandbox";

/** JSON, redirects, files: such a response may load or run nothing, and nothing may frame it. */
const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

/**
 * The site embeds `/create-lineitem` through its own domain (a Vercel rewrite, the Vite proxy in
 * development), so the framing page is same-origin. `FRAME_ANCESTORS` overrides it for a
 * deployment where the frontend is on another origin.
 */
const DEFAULT_FRAME_ANCESTORS = "'self'";

/**
 * HTML of this server: inline scripts and styles of its own templates, nothing from elsewhere.
 * `extra` adds what one kind of page needs on top.
 */
function htmlCsp(frameAncestors: string, extra: { imgSrc: string; frameSrc?: string }): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${extra.imgSrc}`,
    "connect-src 'self'",
    ...(extra.frameSrc ? [`frame-src ${extra.frameSrc}`] : []),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
    "upgrade-insecure-requests",
  ].join("; ");
}

export default fp(
  async (app) => {
    const configured = (app.config as { FRAME_ANCESTORS?: string }).FRAME_ANCESTORS?.trim();
    const frameAncestors = configured || DEFAULT_FRAME_ANCESTORS;
    // The line-item form previews a picked file (blob:), a pasted data URL, a remote creative
    // image, and an HTML creative in a srcdoc frame
    const pageCsp = htmlCsp(frameAncestors, {
      imgSrc: "'self' data: blob: https:",
      frameSrc: "'self'",
    });
    const docsCsp = htmlCsp(frameAncestors, { imgSrc: "'self' data: https:" });

    app.addHook("onSend", async (request, reply, _payload) => {
      const isLineItemPage = request.url.startsWith("/create-lineitem");
      const isTwEmbedCss = request.url.startsWith("/public/assets/tw-embed.css");
      const isDocs = request.url.startsWith("/docs");
      const isHtml = String(reply.getHeader("content-type") ?? "").startsWith("text/html");

      // Uploaded creatives: even a mislabelled file can never run as a page on the API origin
      const isUpload = request.routeOptions?.url === "/uploads/*";
      const csp = isUpload ? UPLOADS_CSP : isDocs ? docsCsp : isHtml ? pageCsp : API_CSP;
      reply.header("Content-Security-Policy", csp);

      if (csp === API_CSP || frameAncestors === "'none'") {
        reply.header("X-Frame-Options", "DENY");
      } else if (frameAncestors === "'self'") {
        reply.header("X-Frame-Options", "SAMEORIGIN");
      } else {
        reply.removeHeader("X-Frame-Options");
      }

      if (isTwEmbedCss || isDocs) {
        reply.header("Cross-Origin-Resource-Policy", "cross-origin");
      }

      if (isLineItemPage || isTwEmbedCss || isDocs) {
        reply.removeHeader("Cross-Origin-Embedder-Policy");
        reply.header("Cross-Origin-Opener-Policy", "same-origin");
      } else {
        reply.header("Cross-Origin-Embedder-Policy", "require-corp");
        reply.header("Cross-Origin-Opener-Policy", "same-origin");
      }

      reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
      reply.header("X-Content-Type-Options", "nosniff");
      // The old XSS auditor is gone from browsers and could itself be abused: switched off
      reply.header("X-XSS-Protection", "0");
      reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
      reply.header(
        "Permissions-Policy",
        [
          "camera=()",
          "microphone=()",
          "geolocation=()",
          "payment=()",
          "usb=()",
          "magnetometer=()",
          "gyroscope=()",
          "accelerometer=()",
        ].join(", "),
      );
      reply.header("X-DNS-Prefetch-Control", "off");

      if (request.url.startsWith("/api/")) {
        reply.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        reply.header("Pragma", "no-cache");
        reply.header("Expires", "0");
      }

      if (!isTwEmbedCss && !isDocs) {
        reply.header("Cross-Origin-Resource-Policy", "same-origin");
      }
    });

    app.log.info("Security headers plugin registered");
  },
  { name: "security-headers" },
);
