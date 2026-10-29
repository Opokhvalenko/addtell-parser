# --- build stage ---
FROM node:22-alpine AS builder
WORKDIR /app

# All dependencies: the build needs tailwindcss and typescript
COPY package*.json ./
RUN npm ci

# prisma
COPY prisma ./prisma
RUN npx prisma generate

# Config and sources
COPY tsconfig.json ./
COPY src ./src

# Output folder for the Tailwind CSS of the server-rendered pages
RUN mkdir -p public/assets

# Tailwind config for the server-rendered templates when the repository has none
RUN [ -f tailwind.config.js ] || cat > tailwind.config.js <<'EOF'
/** auto-generated in Docker build if missing */
export default {
  content: [
    "./src/modules/adserver/ssr/templates/**/*.html",
    "./src/ssr/**/*.{html,ts,tsx,js,jsx}",
    "./src/**/*.{ts,tsx,js,jsx}"
  ],
  theme: { extend: {} },
  plugins: [],
};
EOF

# Build (tsc + tailwind)
RUN npm run build

# The SSR templates are read at runtime from dist
RUN mkdir -p dist/modules/adserver/ssr/templates \
 && cp -r src/modules/adserver/ssr/templates/*.html dist/modules/adserver/ssr/templates/

# Only production dependencies go to the runtime image
RUN npm prune --omit=dev


# --- runtime stage ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libstdc++ openssl ca-certificates && update-ca-certificates

# Read-only for the app: owned by root
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# Written at runtime (uploaded creatives, the feeds manifest): owned by the app user
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir -p /app/uploads/creatives && chown -R node:node /app/uploads
VOLUME ["/app/uploads"]

# Not root: a bug in the app or a dependency cannot change the image or the system
USER node

EXPOSE 3000
# Marks a hung server unhealthy (docker ps, compose depends_on); Render uses its own check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health" > /dev/null || exit 1
CMD ["node","dist/index.js"]
