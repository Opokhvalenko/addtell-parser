# AdServer Backend

Backend сервіс для новинного додатку з рекламою, аналітикою та OpenTelemetry спостереженням.

## 🚀 Технології

- **Fastify v5** - швидкий веб-фреймворк
- **TypeScript** - строга типізація
- **Prisma** - ORM для MongoDB
- **ClickHouse** - аналітична база даних
- **OpenTelemetry** - спостереження (логи, метрики, трейси)
- **Argon2** - хешування паролів
- **JWT** - авторизація
- **Pino** - логування

## 📁 Структура проекту

```
src/
├── app.ts                 # Конфігурація Fastify
├── index.ts              # Точка входу
├── config/               # Конфігурація
├── modules/              # Бізнес-логіка
│   ├── auth/             # Авторизація
│   ├── feed/             # Новинні стрічки
│   ├── adserver/         # Рекламний сервер
│   ├── stats/            # Аналітика
│   └── uploads/          # Завантаження файлів
├── plugins/              # Fastify плагіни
├── routes/               # Маршрути
├── telemetry/            # OpenTelemetry
└── utils/                # Утиліти
```

## 🛠 Встановлення

```bash
# Встановлення залежностей
npm install

# Генерація Prisma клієнта
npm run prisma:generate

# Запуск в режимі розробки
npm run dev
```

## 🔧 Налаштування

Створіть файл `.env`:

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
APP_ORIGIN=http://localhost:5173

# База даних
DATABASE_URL="mongodb://localhost:27017/feeds"

# Секрети
JWT_SECRET=your-32-char-secret
COOKIE_SECRET=your-32-char-secret
COOKIE_SECURE=false

# ClickHouse (опціонально)
CLICKHOUSE_URL=http://127.0.0.1:8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=changeme
CLICKHOUSE_DB=analytics

# Cron завдання
CRON_ENABLE=true
CRON_FEEDS_SCHEDULE=*/10 * * * *
CRON_TZ=UTC

# Фіди
DEFAULT_FEED_URL=https://hnrss.org/frontpage
FEEDS_SOURCES=["https://hnrss.org/frontpage","https://hnrss.org/newest"]

# Завантаження
UPLOADS_DIR=./uploads
```

## 🚀 Запуск

### Локальний розробка

```bash
# Запуск з hot reload
npm run dev

# Запуск тестів
npm test

# Лінтинг
npm run lint
```

### Docker

```bash
# Запуск з Docker Compose
docker compose up -d

# Перевірка статусу
docker compose ps
```

## 📊 API Endpoints

### Health Check
- `GET /health` - статус сервера
- `GET /health/db` - статус бази даних
- `GET /health/clickhouse` - статус ClickHouse

### Авторизація
- `POST /api/auth/register` - реєстрація
- `POST /api/auth/login` - вхід
- `POST /api/auth/logout` - вихід
- `GET /api/auth/me` - поточний користувач

### Новинні стрічки
- `GET /api/feed` - отримання новин
- `GET /api/article` - отримання статті

### Рекламний сервер
- `POST /api/adserver/lineitems` - створення рекламного блоку
- `POST /api/adserver/bid` - bid endpoint
- `GET /api/beautiful-ad` - красива реклама

### Аналітика
- `POST /api/stats/ingest` - збір подій
- `GET /api/stats` - статистика
- `GET /api/stats/export` - експорт даних

### Завантаження
- `POST /api/upload` - завантаження файлів
- `GET /uploads/*` - статичні файли

## 🔍 OpenTelemetry

Проект налаштований з OpenTelemetry для спостереження:

- **Логи** - структуровані логи через Pino
- **Метрики** - HTTP запити, база даних, файлова система
- **Трейси** - розподілене трасування

### Консольні експортери

В режимі розробки всі дані виводяться в консоль:
- Логи: структуровані JSON логи
- Метрики: HTTP запити, тривалість, статус коди
- Трейси: розподілене трасування запитів

## 🧪 Тестування

```bash
# Запуск всіх тестів
npm test

# Запуск з watch режимом
npm run test:watch

# Покриття коду
npm run test:coverage
```

### Структура тестів

- `tests/health.test.ts` - health endpoints
- `tests/auth.test.ts` - авторизація
- `tests/feed.test.ts` - новинні стрічки
- `tests/adserver.test.ts` - рекламний сервер
- `tests/stats.test.ts` - аналітика
- `tests/integration.test.ts` - інтеграційні тести

## 📈 Моніторинг

### Логи
- Структуровані JSON логи
- Рівні: error, warn, info, debug
- Контекст: requestId, userId, timestamp

### Метрики
- `http_requests_total` - кількість HTTP запитів
- `http_request_duration_ms` - тривалість запитів
- `db_operations_total` - операції з БД
- `process_memory_usage_bytes` - використання пам'яті

### Трейси
- Розподілене трасування HTTP запитів
- Операції з базою даних
- Зовнішні API виклики

## 🔒 Безпека

- **CORS** - налаштований для frontend
- **JWT** - токени авторизації
- **HttpOnly cookies** - безпечні cookies
- **Argon2** - стійке хешування паролів
- **Валідація** - Zod схеми для всіх endpoint'ів

## 🚀 Деплой

### Environment Variables

```env
NODE_ENV=production
DATABASE_URL=mongodb://...
JWT_SECRET=production-secret
COOKIE_SECRET=production-secret
COOKIE_SECURE=true
```

### Production Build

```bash
npm run build
npm start
```

## 📝 Ліцензія

MIT License