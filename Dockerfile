FROM node:20-alpine AS builder
WORKDIR /app

# deps
COPY package*.json ./
RUN npm ci

# код і конфіги
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# згенерувати клієнт і зібрати TS
RUN npm run build

# ===== runner =====
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Потрібен openssl для prisma engines
RUN apk add --no-cache openssl

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node","dist/index.js"]