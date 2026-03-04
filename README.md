# 🍟 SnackSpot

A mobile-first social food-review app. Users post snack & meal reviews with photos and location. Discover the best spots near you.

## Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 15 (App Router, TypeScript) + Tailwind CSS |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| Cache / queue | Redis 7 + BullMQ |
| Object storage | MinIO (S3-compatible) |
| Auth | Argon2id passwords · JWT access token · httpOnly refresh cookie |
| Image processing | Sharp (WebP variants, EXIF strip) – runs in worker |
| Validation | Zod |
| Logging | pino |
| Rate limiting | Redis sliding-window (per IP + per user) |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) ≥ 24 & [Docker Compose](https://docs.docker.com/compose/) ≥ 2.20
- Nothing else is required to *run*. Node.js / pnpm are only needed for local dev.

---

## Quickstart (production mode)

```bash
# 1. Clone and enter
git clone <repo> snackspot && cd snackspot

# 2. Create your env file
cp .env.example .env

# 3. Generate strong secrets (Linux/macOS):
sed -i "s/change-me-access-secret-.*/$(openssl rand -hex 64)/" .env
sed -i "s/change-me-refresh-secret-.*/$(openssl rand -hex 64)/" .env

# 4. Build and start all services (db, redis, minio, migrate, web, worker)
docker compose -f infra/docker/docker-compose.yml up -d --build

# 5. Check logs
docker compose -f infra/docker/docker-compose.yml logs -f web migrate
```

The app is now available at **http://localhost:3000**

---

## Default ports

| Service | Port | URL |
|---|---|---|
| Web app | 3000 | http://localhost:3000 |
| MinIO API | 9000 | http://localhost:9000 |
| MinIO Console | 9001 | http://localhost:9001 |
| PostgreSQL | (internal) | `db:5432` inside Docker network |
| Redis | (internal) | `redis:6379` inside Docker network |

---

## Migrations

Migrations run automatically on startup via the `migrate` service.

To run manually:

```bash
# From host (requires pnpm installed)
DATABASE_URL="postgresql://snackspot:snackspot@localhost:5432/snackspot" \
  pnpm --filter @snackspot/db migrate

# Or inside the running container
docker compose -f infra/docker/docker-compose.yml exec web \
  node packages/db/scripts/migrate.mjs
```

---

## Seed data

```bash
# Requires the DB to be running and migrated
DATABASE_URL="postgresql://snackspot:snackspot@localhost:5432/snackspot" \
  pnpm --filter @snackspot/db seed
```

Demo accounts (password for all: **Password1!**):

| Email | Role |
|---|---|
| admin@snackspot.local | ADMIN |
| mod@snackspot.local | MODERATOR |
| alice@example.com | USER |
| bob@example.com | USER |

> **Note:** The seed uses a pre-hashed placeholder. The real API uses argon2id; the seed accounts work for demo purposes only. To use them for login testing, update the password hashes via the API's register endpoint or reset them manually.

---

## MinIO Console

1. Open http://localhost:9001
2. Log in with `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` from your `.env`
3. Browse the `snackspot` bucket
4. Originals: `originals/<userId>/<uuid>.<ext>`
5. Processed variants: `variants/<uuid>/thumb.webp`, `medium.webp`, `large.webp`

---

## Local development (without Docker)

```bash
# Install deps
pnpm install

# Start infrastructure (DB + Redis + MinIO) – keep this running
docker compose -f infra/docker/docker-compose.yml up -d db redis minio

# Run migrations
pnpm db:migrate

# Generate Prisma client
pnpm db:generate

# Start web dev server
pnpm dev

# Start worker (separate terminal)
pnpm worker:dev
```

---

## API overview

All endpoints are versioned under `/api/v1`.

### Auth
```
POST /api/v1/auth/register   – create account
POST /api/v1/auth/login      – get access token + set refresh cookie
POST /api/v1/auth/refresh    – rotate refresh token, return new access token
POST /api/v1/auth/logout     – revoke refresh token
GET  /api/v1/auth/me         – current user (Bearer)
```

### Feed
```
GET /api/v1/feed?cursor=&limit=   – newest reviews (cursor pagination)
```

### Places
```
GET /api/v1/places/search?q=&lat=&lng=&radius=   – text or geo search
GET /api/v1/places/:id                           – place detail + avg rating
GET /api/v1/places/:id/reviews?sort=new|top      – reviews for place
```

### Reviews
```
POST   /api/v1/reviews          – create review (Bearer, rate-limited)
GET    /api/v1/reviews/:id
PATCH  /api/v1/reviews/:id      – update (owner only)
DELETE /api/v1/reviews/:id      – soft-delete (owner or mod/admin)
```

### Photos
```
POST /api/v1/photos/initiate-upload   – get presigned PUT URL
POST /api/v1/photos/confirm-upload    – verify upload, enqueue processing
```

### Moderation (MODERATOR / ADMIN)
```
GET  /api/v1/mod/queue     – open reports
POST /api/v1/mod/actions   – hide/delete/ban/dismiss
```

---

## Photo upload flow

```
Client          API              MinIO           Worker
  │                │                │               │
  ├─POST initiate──►│                │               │
  │◄─── presigned URL ──────────────┤               │
  │                │                │               │
  ├─PUT file ──────────────────────►│               │
  │                │                │               │
  ├─POST confirm ──►│                │               │
  │                ├─ verify exists─►│               │
  │                ├─ enqueue job ──────────────────►│
  │◄─ { status: "processing" }      │               │
  │                │                │               │
  │                │     Worker: download, re-encode, upload variants
  │                │                │◄──────────────┤
  │                │                ├─ update DB ───►│
```

---

## Security notes

- **Passwords** hashed with Argon2id (memoryCost 64 MiB, timeCost 3, parallelism 4)
- **JWT** access tokens expire in 15 min; refresh tokens rotate on every use
- **Rate limits**: login 10/15 min per IP, register 5/h per IP, review-create 20/h per user, photo-upload 30/h per user
- **Uploads**: allowlist of MIME types, max 10 MB, max 5 per review; originals are never served publicly
- **EXIF stripping**: Sharp removes all metadata from processed variants
- **CSP / security headers** set by Next.js config on every response
- **CORS** locked to `CORS_ORIGINS` env var
- **Cookies** are `HttpOnly; SameSite=Strict; Secure` (Secure in production)
- **RBAC**: owner-only edits, mod/admin moderation actions, admin-only bans

---

## Directory structure

```
snackspot/
├── apps/
│   ├── web/           # Next.js 15 (App Router) – frontend + REST API
│   │   ├── app/
│   │   │   ├── api/v1/         # Route handlers
│   │   │   ├── (app)/          # Authenticated app pages
│   │   │   ├── auth/           # Login / register pages
│   │   │   ├── place/[id]/
│   │   │   └── review/[id]/
│   │   ├── components/         # React components
│   │   └── lib/                # Server utilities (db, auth, redis, minio…)
│   └── worker/        # BullMQ image-processing worker
├── packages/
│   ├── db/            # Prisma schema + SQL migrations + seed
│   ├── shared/        # Zod schemas + shared types
│   └── ui/            # Shared React UI components
└── infra/
    ├── docker/        # docker-compose.yml + Dockerfile.migrate
    └── nginx/         # Optional reverse-proxy config
```
