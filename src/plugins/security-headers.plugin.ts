import fp from "fastify-plugin";

export default fp(
  async (app) => {
    app.addHook("onSend", async (request, reply, _payload) => {
      const cfg = app.config as typeof app.config & { FRAME_ANCESTORS?: string; NODE_ENV?: string };
      const isProd = (cfg.NODE_ENV ?? process.env.NODE_ENV) === "production";

      const devDefaults =
        "'self' http://localhost:3000 http://127.0.0.1:3000 http://localhost:5173 http://127.0.0.1:5173";

      const FRAME_ANCESTORS =
        cfg.FRAME_ANCESTORS && cfg.FRAME_ANCESTORS.trim().length > 0
          ? cfg.FRAME_ANCESTORS.trim()
          : isProd
            ? "'none'"
            : devDefaults;

      const isLineItemPage = request.url.startsWith("/create-lineitem");
      const isTwEmbedCss = request.url.startsWith("/public/assets/tw-embed.css");
      const isDocs = request.url.startsWith("/docs");

      const baseImgSrc = "img-src 'self' data: https: http:";
      const imgSrc = isLineItemPage ? `${baseImgSrc} blob:` : baseImgSrc;

      const defaultCsp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        imgSrc,
        "connect-src 'self' https://www.google-analytics.com https://analytics.google.com",
        "frame-src 'self' https://www.google.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        `frame-ancestors ${FRAME_ANCESTORS}`,
        "upgrade-insecure-requests",
      ].join("; ");

      const docsCsp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https: http:",
        "connect-src 'self'",
        "frame-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        `frame-ancestors ${FRAME_ANCESTORS}`,
        "upgrade-insecure-requests",
      ].join("; ");

      reply.header("Content-Security-Policy", isDocs ? docsCsp : defaultCsp);

      if (FRAME_ANCESTORS === "'none'") {
        reply.header("X-Frame-Options", "DENY");
      } else if (FRAME_ANCESTORS === "'self'") {
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
      reply.header("X-XSS-Protection", "1; mode=block");
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
