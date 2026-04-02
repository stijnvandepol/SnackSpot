# SnackSpot

**A mobile-first social app for discovering under-the-radar food spots.** Post reviews with photos and location tags, and help other people find smaller local places that are easy to miss.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Quickstart with Docker](#quickstart-with-docker)
  - [Local Development](#local-development)
- [Configuration](#configuration)
- [Default Ports](#default-ports)
- [Admin Panel](#admin-panel)
- [API Reference](#api-reference)
- [Photo Upload Flow](#photo-upload-flow)
- [Database](#database)
- [Testing](#testing)
- [Security](#security)
- [Contributing](#contributing)

---

## Features

**For users:**
- Register and log in with a personal profile (avatar, bio, username)
- Write reviews with multi-dimensional ratings: taste, value, portion size, service
- Attach up to 5 photos per review (auto-converted to WebP with multiple size variants)
- Like and comment on reviews; mention other users with `@username`
- Discover places via text search or geolocation (nearby radius search)
- Earn badges for milestones: post streaks, unique locations, engagement, and more
- Receive in-app and email notifications for likes, comments, mentions, and badge awards
- Dark mode support — toggle in profile settings
- Browse user profiles and their review history

**For moderators and admins:**
- Admin panel (separate app on port 3001) for managing users, restaurants, reviews, and reports
- Soft-delete reviews, hide content, ban/unban users, reset passwords
- Handle community reports with open/resolved/dismissed statuses
- Dashboard with stats and activity overview

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 15 (App Router, TypeScript) + Tailwind CSS + React 19 |
| Admin Panel | Next.js 14 (App Router, TypeScript) |
| Database | PostgreSQL 16 + PostGIS 3.4 (geospatial queries) |
| Cache / Queue | Redis 7 + BullMQ 5 |
| Object Storage | MinIO (S3-compatible) |
| Auth | Argon2id password hashing · JWT access tokens · httpOnly refresh cookies |
| Image Processing | Sharp — WebP conversion, EXIF stripping, multi-size variants (runs in worker) |
| Validation | Zod |
| ORM | Prisma |
| Logging | Pino |
| Rate Limiting | Redis sliding-window counters (per IP + per user) |
| Package Manager | pnpm 9 (workspace monorepo) |
| Testing | Vitest |
| Runtime | Node.js 20+ |

---

## Project Structure

```
snackspot/
├── apps/
│   ├── web/                   # Next.js 15 — main app (frontend + REST API v1)
│   │   ├── app/
│   │   │   ├── api/v1/        # All REST API route handlers
│   │   │   ├── (app)/         # Authenticated pages (feed, profile, add review)
│   │   │   ├── auth/          # Login / register pages
│   │   │   ├── place/[id]/    # Place detail page
│   │   │   ├── review/[id]/   # Review detail page
│   │   │   └── u/[username]/  # Public user profile
│   │   ├── components/        # Shared React components
│   │   └── lib/               # Server utilities (auth, DB, Redis, MinIO, rate limiting)
│   │
│   ├── admin/                 # Next.js 14 — admin dashboard (port 3001)
│   │   ├── app/
│   │   │   ├── api/           # Admin API endpoints
│   │   │   └── dashboard/     # Admin UI pages
│   │   └── lib/               # Admin auth, DB, rate limiting
│   │
│   └── worker/                # BullMQ background worker — image processing
│       └── src/index.ts
│
├── packages/
│   ├── db/                    # Prisma schema + SQL migrations + seed script
│   ├── shared/                # Zod schemas + shared TypeScript types
│   └── ui/                    # Shared React UI components (e.g. star rating)
│
└── infra/
    ├── docker/                # docker-compose.yml + Dockerfile.migrate
    └── nginx/                 # Optional reverse-proxy config
```

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/) ≥ 2.20

> Node.js and pnpm are only required for [local development](#local-development).

---

### Quickstart with Docker

```bash
# 1. Clone the repository
git clone https://github.com/stijnvandepol/SnackSpot.git
cd SnackSpot

# 2. Copy the environment template
cp .env.example .env

# 3. Generate strong JWT secrets and paste them into .env
openssl rand -hex 64   # → JWT_ACCESS_SECRET
openssl rand -hex 64   # → JWT_REFRESH_SECRET

# 4. Set the remaining required values in .env:
#    POSTGRES_PASSWORD, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_PUBLIC_URL

# 5. Build and start all services
docker compose up -d --build

# 6. Follow startup logs
docker compose logs -f web migrate
```

The app is now available at **http://localhost:8080**

> The ports are bound to `0.0.0.0`, so the app is also reachable on your local network at `http://<your-host-ip>:8080`.

#### Verify everything is running

```bash
docker compose ps
```

All services should show status `healthy`. The `migrate` container will have exited (that is expected — it runs once and stops).

---

### Local Development

Run only the infrastructure in Docker and the app natively for hot-reloading.

```bash
# Install dependencies
pnpm install

# Start infrastructure (keep this terminal open or use -d)
docker compose up -d db redis minio

# Apply database migrations
pnpm db:migrate

# Generate the Prisma client
pnpm db:generate

# Start the web app (terminal 1)
pnpm dev

# Start the image-processing worker (terminal 2)
pnpm worker:dev
```

#### Seed demo data

```bash
DATABASE_URL="postgresql://snackspot:snackspot@localhost:5432/snackspot" \
  pnpm --filter @snackspot/db seed
```

Demo accounts (all use password `Password1!`):

| Email | Role |
|---|---|
| admin@snackspot.local | ADMIN |
| mod@snackspot.local | MODERATOR |
| alice@example.com | USER |
| bob@example.com | USER |

---

## Configuration

Copy `.env.example` to `.env` and fill in the values below.

### Required

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | Password for the PostgreSQL `snackspot` user |
| `DATABASE_URL` | Full connection string — keep in sync with `POSTGRES_PASSWORD` |
| `MINIO_ACCESS_KEY` | MinIO root username |
| `MINIO_SECRET_KEY` | MinIO root password |
| `MINIO_PUBLIC_URL` | Public-facing base URL for MinIO (e.g. `https://storage.example.com`) |
| `JWT_ACCESS_SECRET` | Min 32 chars — generate with `openssl rand -hex 64` |
| `JWT_REFRESH_SECRET` | Min 32 chars — generate with `openssl rand -hex 64` |

### Optional / Defaults

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://redis:6379` | Redis connection URL |
| `MINIO_ENDPOINT` | `minio` | MinIO hostname inside Docker network |
| `MINIO_PORT` | `9000` | MinIO API port |
| `MINIO_USE_SSL` | `false` | Enable TLS for MinIO connections |
| `MINIO_BUCKET` | `snackspot` | Bucket name |
| `MINIO_CORS_ORIGINS` | `*` | CORS origins for direct browser uploads |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_DAYS` | `7` | Refresh token lifetime in days |
| `AUTH_COOKIE_SECURE` | `false` | Set to `true` when serving over HTTPS |
| `NEXT_PUBLIC_APP_URL` | `https://snackspot.online` | Public URL of the web app |
| `CORS_ORIGINS` | `https://snackspot.online` | Comma-separated allowed API origins |
| `MAX_FILE_SIZE_BYTES` | `10485760` | Max upload size (10 MB) |
| `MAX_PHOTOS_PER_REVIEW` | `5` | Max photos per review |
| `ADMIN_BIND_ADDRESS` | `0.0.0.0` | Network interface for the admin panel |

### LAN / Cloudflare Tunnel setup

For access outside localhost, update your `.env`:

```env
NEXT_PUBLIC_APP_URL=https://app.example.com
MINIO_PUBLIC_URL=https://storage.example.com
CORS_ORIGINS=https://app.example.com
MINIO_CORS_ORIGINS=*
AUTH_COOKIE_SECURE=true
```

> If you only tunnel the web app but not MinIO, photo uploads will fail — uploads go directly from the browser to MinIO using presigned URLs.

---

## Default Ports

| Service | Port | URL |
|---|---|---|
| Web app | 8080 | http://localhost:8080 |
| Admin panel | 3001 | http://localhost:3001 |
| MinIO API | 9000 | http://localhost:9000 |
| MinIO Console | 9001 | http://localhost:9001 |
| PostgreSQL | (internal) | `db:5432` — Docker network only |
| Redis | (internal) | `redis:6379` — Docker network only |

---

## Admin Panel

The admin panel is a separate Next.js app running on port 3001.

**Capabilities:**
- User management — view, edit, ban/unban, reset passwords
- Restaurant management — CRUD, bulk delete empty restaurants
- Review moderation — hide, delete, change status
- Report handling — open/resolved/dismissed workflow
- Dashboard with stats and open-report counter

### Create an admin user

```sql
-- Connect to the database
psql postgresql://snackspot:YOUR_PASSWORD@localhost:5432/snackspot

-- Promote an existing user to ADMIN
UPDATE users SET role = 'ADMIN' WHERE email = 'your@email.com';
```

Then log in at http://localhost:3001.

### Security

> **The admin panel must not be publicly accessible.**

Recommended options (in order of preference):

1. Cloudflare Tunnel + OAuth — see [apps/admin/CLOUDFLARE_SETUP.md](apps/admin/CLOUDFLARE_SETUP.md)
2. Nginx reverse proxy with IP allowlist
3. VPN or SSH tunnel
4. Firewall rule blocking port 3001 from public interfaces

See [apps/admin/README.md](apps/admin/README.md) and [apps/admin/SECURITY.md](apps/admin/SECURITY.md) for full documentation.

---

## API Reference

All endpoints are prefixed with `/api/v1`.

### Authentication

```
POST /api/v1/auth/register          Create a new account
POST /api/v1/auth/login             Login — returns access token + sets refresh cookie
POST /api/v1/auth/refresh           Rotate refresh token — returns new access token
POST /api/v1/auth/logout            Revoke refresh token
GET  /api/v1/auth/me                Get current user (Bearer)
```

### Feed & Reviews

```
GET    /api/v1/feed                 Newest reviews (cursor pagination)
GET    /api/v1/me/reviews           Current user's reviews (Bearer)
POST   /api/v1/reviews              Create a review (Bearer, rate-limited)
GET    /api/v1/reviews/:id          Get review by ID
PATCH  /api/v1/reviews/:id          Update review (owner only)
DELETE /api/v1/reviews/:id          Soft-delete (owner or mod/admin)
```

### Places

```
GET /api/v1/places/search?q=&lat=&lng=&radius=    Text or geo search
GET /api/v1/places/:id                             Place detail + average ratings
GET /api/v1/places/:id/reviews?sort=new|top        Reviews for a place
```

### Photos

```
POST /api/v1/photos/initiate-upload     Get presigned PUT URL for direct upload
POST /api/v1/photos/confirm-upload      Confirm upload, enqueue processing
POST /api/v1/photos/upload-fallback     Same-origin fallback (when direct upload is blocked)
```

### Social

```
POST   /api/v1/reviews/:id/likes           Like a review (Bearer)
DELETE /api/v1/reviews/:id/likes           Unlike a review (Bearer)
GET    /api/v1/reviews/:id/comments        Get comments on a review
POST   /api/v1/reviews/:id/comments        Post a comment (Bearer)
DELETE /api/v1/comments/:id                Delete a comment (owner or mod/admin)
```

### Users

```
GET /api/v1/users/:username             Public user profile
GET /api/v1/users/:username/reviews     Reviews by user
GET /api/v1/users/exists?username=      Check if username is taken
```

### Moderation (MODERATOR / ADMIN only)

```
GET  /api/v1/mod/queue      Open reports queue
POST /api/v1/mod/actions    Take action: hide / delete / ban / dismiss
```

---

## Photo Upload Flow

Photos are uploaded directly from the browser to MinIO using presigned URLs. A background worker then processes them asynchronously.

```
Client          API                 MinIO           Worker
  │               │                   │               │
  ├─ POST initiate ►│                   │               │
  │◄── presigned URL ──────────────────┤               │
  │               │                   │               │
  ├─ PUT file ─────────────────────── ►│               │
  │               │                   │               │
  ├─ POST confirm ─►│                   │               │
  │               ├─ verify exists ───►│               │
  │               ├─ enqueue job ───────────────────── ►│
  │◄── { status: "processing" }        │               │
  │               │                   │               │
  │               │    Worker: download → WebP → upload variants
  │               │                   │◄──────────────┤
  │               │                   ├─ update DB ───►│
```

**Processed variants:**

| Name | Max size |
|---|---|
| `thumb.webp` | 256 px |
| `medium.webp` | 1024 px |
| `large.webp` | 2048 px |

Originals are stored in `originals/<userId>/<uuid>.<ext>` and never served publicly.

---

## Database

### Migrations

Migrations run automatically on startup via the `migrate` Docker service.

To run manually:

```bash
# From host (requires pnpm)
DATABASE_URL="postgresql://snackspot:PASSWORD@localhost:5432/snackspot" \
  pnpm --filter @snackspot/db migrate

# Or inside the running container
docker compose exec web node packages/db/scripts/migrate.mjs
```

### MinIO Console

1. Open http://localhost:9001
2. Log in with `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` from your `.env`
3. Browse the `snackspot` bucket

---

## Testing

Unit tests are written with [Vitest](https://vitest.dev/).

```bash
# Run all tests once
pnpm test

# Watch mode
pnpm test:watch
```

**Test coverage:**
- Badge progress calculations (`badge-service.test.ts`)
- Rating normalization (`ratings.test.ts`)
- `@mention` parsing (`mentions.test.ts`)
- Review schema validation (`review-schema.test.ts`)

---

## Security

| Topic | Implementation |
|---|---|
| **Passwords** | Argon2id — 64 MiB memory, 3 iterations, parallelism 4 |
| **JWT** | Access tokens expire in 15 min; refresh tokens rotate on every use |
| **Rate limiting** | Login: 10/15 min per IP · Register: 5/h per IP · Reviews: 20/h per user · Photo upload: 30/h per user |
| **CORS** | Strict origin matching via `CORS_ORIGINS` |
| **Uploads** | MIME type allowlist · 10 MB max · 5 photos max per review |
| **EXIF stripping** | Sharp removes all metadata from processed photo variants |
| **Security headers** | CSP and other headers set by Next.js config on every response |
| **Cookies** | `HttpOnly; SameSite=Strict`; `Secure` controlled by `AUTH_COOKIE_SECURE` |
| **RBAC** | Owner-only edits · mod/admin moderation actions · admin-only bans |
| **Docker** | `no-new-privileges` · all capabilities dropped · read-only filesystem · resource limits |
| **Proxy trust** | Explicit `TRUST_PROXY=true` required for correct IP detection behind reverse proxies |

---

## Contributing

1. Fork the repository and create a branch from `dev`: `git checkout -b feat/your-feature`
2. Make your changes and run tests: `pnpm test`
3. Open a pull request targeting `main` — the CI pipeline runs automatically and must pass before merging
4. The CI checks: unit tests (Vitest) + full build verification for all three apps
