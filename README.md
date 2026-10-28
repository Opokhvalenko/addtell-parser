# AdTell Backend — Ad Server & News API

Backend service for a news platform with programmatic ad serving, real-time analytics, and full observability. Handles RSS feed aggregation, header bidding auctions, user authentication, and event tracking.

## Demo

[API Docs (Swagger)](https://addtell-backend.onrender.com/docs)

## Tech Stack

**Runtime:** Fastify v5, TypeScript, Node.js 20
**Database:** MongoDB + Prisma ORM; analytics in MongoDB (TTL) or ClickHouse (`ANALYTICS_STORE=clickhouse`)
**Auth:** Argon2, JWT, HttpOnly signed cookies
**Observability:** OpenTelemetry (traces, metrics, logs), Pino
**Ads:** Custom ad server with bid auction, frequency capping, SSR creatives
**Infrastructure:** Docker, Docker Compose, Render

## Features

- **RSS Feed Aggregation** — cron-based feed sync, article extraction with HTML sanitization (DOMPurify)
- **Ad Server** — line item management, bid endpoint with filtering pipeline (size, geo, floor CPM, frequency cap)
- **Header Bidding Support** — bid/win endpoints for Prebid.js integration
- **Analytics Pipeline** — validated, rate-limited event ingestion → bounded in-memory batching → MongoDB (30-day TTL) or ClickHouse → aggregated stats for signed-in users
- **Auth System** — Argon2 password hashing, JWT in HttpOnly signed cookies, role-based route guards
- **OpenTelemetry** — distributed tracing, HTTP/DB metrics, structured logging with correlation IDs
- **Security** — CSP, HSTS, X-Frame-Options, rate limiting, input validation (Zod)
- **SSR Pages** — server-rendered ad creation form with Tailwind CSS

## Architecture

```
src/
├── modules/              # Domain logic
│   ├── auth/             # Register, login, JWT, password hashing
│   ├── feed/             # RSS parsing, article extraction, caching
│   ├── adserver/         # Line items, bid auction, filtering pipeline
│   │   ├── service/      # create, pick (auction), filters
│   │   ├── pipeline/     # Filter chain: active, adType, floor, geo, size
│   │   ├── repo/         # Data access (lineItem, creative, impression, stats)
│   │   └── ssr/          # Server-rendered pages
│   ├── analytics/        # Event ingestion, ClickHouse writes
│   ├── stats/            # Aggregation queries, CSV export
│   ├── creatives/        # Ad creative management
│   └── uploads/          # File upload handling
├── plugins/              # 32 Fastify plugins (auth, jwt, cors, swagger, otel, etc.)
├── cron/                 # Scheduled feed sync
├── telemetry/            # OpenTelemetry setup (traces, metrics, logs)
├── config/               # Env validation (Zod schema)
└── utils/                # Shared utilities
```

## Getting Started

```bash
git clone https://github.com/Opokhvalenko/addtell-parser.git
cd addtell-parser/backend
npm install
npm run prisma:generate
npm run dev
```

## Environment Variables

Copy `.env.example` and configure:

```env
DATABASE_URL="mongodb://localhost:27017/feeds"
JWT_SECRET=your-32-char-secret
COOKIE_SECRET=your-32-char-secret
APP_ORIGIN=http://localhost:5173

# Optional
CLICKHOUSE_URL=http://127.0.0.1:8123
CRON_ENABLE=true
CRON_FEEDS_SCHEDULE=*/10 * * * *
```

See `.env.example` for all available options.

## API Endpoints

### Health
- `GET /health` — server status
- `GET /health/db` — MongoDB health

### Auth
- `POST /api/auth/register` — create user (Argon2 hash)
- `POST /api/auth/login` — login (JWT in HttpOnly cookie)
- `POST /api/auth/logout` — clear session
- `GET /api/auth/me` — current user (requires auth)

### Feed
- `GET /api/feed` — news feed (cached, RSS parsed)
- `GET /api/article?url=...` — single article with sanitized HTML

### Ad Server
- `POST /api/adserver/lineitems` — create ad line item (requires auth)
- `POST /api/adserver/bid` — bid request (filtering pipeline)
- `GET /api/beautiful-ad` — house ad endpoint

### Analytics
- `POST /api/analytics/events` — public: a batch of up to 100 events (schema-validated, rate-limited per IP)
- `GET /api/analytics/stats?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day,event,adapter&metrics=count,wins,cpmAvg` — requires a session, range ≤ 90 days

### Uploads
- `POST /api/upload` — upload creative (requires auth)

## Docker

```bash
docker compose up -d
```

Starts MongoDB (replica set), ClickHouse, and backend.

## Scripts

```bash
npm run dev            # Dev server with hot reload + pino-pretty
npm run build          # TypeScript + Tailwind CSS
npm start              # Production server
npm test               # Run tests (Node.js test runner)
npm run lint           # Biome check
npm run prisma:generate # Generate Prisma client
npm run prisma:push    # Push schema to MongoDB
```

## License

MIT
