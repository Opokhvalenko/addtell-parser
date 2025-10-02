# --- build stage ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# копіюємо SSR-шаблони у dist
RUN mkdir -p dist/modules/adserver/ssr/templates \
 && cp -r src/modules/adserver/ssr/templates/*.html dist/modules/adserver/ssr/templates/

# --- runtime stage ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libstdc++ openssl ca-certificates && update-ca-certificates

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# uploads (і віддача статики, якщо потрібно)
RUN mkdir -p /app/uploads/creatives
VOLUME ["/app/uploads"]

EXPOSE 3000
CMD ["node","dist/index.js"]