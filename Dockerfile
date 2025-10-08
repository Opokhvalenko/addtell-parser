# --- build stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# deps (ставимо з devDeps, щоб був tailwindcss)
COPY package*.json ./
RUN npm ci

# prisma
COPY prisma ./prisma
RUN npx prisma generate

# конфіги/код
COPY tsconfig.json ./
COPY src ./src

# створимо публічну папку під CSS з tailwind
RUN mkdir -p public/assets

# якщо немає tailwind.config.js у репо — згенеруємо дефолтний
# (покриває SSR-шаблони та будь-які *.ts(x)/*.js(x) у src)
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

# збірка (tsc + tailwind)
RUN npm run build

# копіюємо SSR-шаблони у dist
RUN mkdir -p dist/modules/adserver/ssr/templates \
 && cp -r src/modules/adserver/ssr/templates/*.html dist/modules/adserver/ssr/templates/

# прибираємо dev-залежності перед переносом у рантайм
RUN npm prune --omit=dev


# --- runtime stage ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libstdc++ openssl ca-certificates && update-ca-certificates

# прод-залежності та артефакти
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public

# uploads (і віддача статики, якщо потрібно)
RUN mkdir -p /app/uploads/creatives
VOLUME ["/app/uploads"]

EXPOSE 3000
CMD ["node","dist/index.js"]