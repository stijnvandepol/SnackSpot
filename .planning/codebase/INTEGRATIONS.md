# External Integrations

**Analysis Date:** 2026-04-06

## APIs & External Services

**Geolocation & Mapping:**
- OpenStreetMap Nominatim API - Geocoding and reverse geocoding
  - SDK/Client: Fetch-based HTTP calls (no SDK)
  - Usage: Forward/reverse geocoding for review location lookup in `apps/web/app/(app)/add-review/page.tsx`
  - Endpoint: `https://nominatim.openstreetmap.org/search` and `/reverse`
  - Rate limiting: Client-side debounce (no explicit rate limit handling)

- MapLibre GL - Vector map rendering
  - SDK/Client: `maplibre-gl` 5.19.0
  - Usage: Map display for food spot discovery interface
  - Tile source: Carto BaseMaps (CDN: `basemaps.cartocdn.com`)

**IP Geolocation:**
- ipapi.co - IP-based geolocation (mentioned in CSP config)
  - SDK/Client: Browser fetch
  - Purpose: User location detection (referenced in next.config.mjs)

**Bot Protection:**
- Cloudflare Turnstile - CAPTCHA verification
  - SDK/Client: `@marsidev/react-turnstile` 1.5.0 (browser), native fetch (server)
  - Auth: 
    - Public key: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (build-time env)
    - Secret key: `TURNSTILE_SECRET_KEY` (server-side)
  - Verification endpoint: `https://challenges.cloudflare.com/turnstile/v0/siteverify`
  - Usage: Form submission protection (login, registration, review creation)
  - Implementation: `apps/web/lib/turnstile.ts`
  - Token validation: Single-use tokens, returns false on network error or invalid token

**Email Service:**
- Resend - Transactional email platform
  - SDK/Client: `resend` 6.9.3
  - Auth: `RESEND_API_KEY`
  - From address: `RESEND_FROM_EMAIL` (default: noreply@snackspot.online)
  - Implementation: `apps/web/lib/email.ts`
  - Email types: Welcome, password reset, notification (likes/comments/mentions), badge unlock, marketing
  - Patterns:
    - Primary template with fallback HTML template for maximum compatibility
    - HTML emails with branded styling, plain text alternatives
    - Message tagging via `tags` parameter for analytics
    - Category tags: notification-like, notification-comment, notification-mention, notification-badge, welcome, password-reset, password-changed, marketing
    - Fallback strategy: If primary send fails, retries with simplified HTML template

## Data Storage

**Databases:**
- PostgreSQL 16 with PostGIS 3.4 extension
  - Connection: Via `DATABASE_URL` env var
  - Pool URL (optional): `DATABASE_POOL_URL` for PgBouncer connection pooling
  - Client: `@prisma/client` 5.22.0
  - ORM: Prisma with schema at `packages/db/prisma/schema.prisma`
  - Models: User, Review, Photo, Place, Badge, Report, ModerationLog, etc.
  - Geospatial: PostGIS for location-based queries (implied by schema)
  - Direct driver: `pg` 8.13.0 (used in migrations)

**File Storage:**
- MinIO (S3-compatible object storage)
  - Connection: `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`
  - Auth: `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
  - Bucket: `MINIO_BUCKET` (default: snackspot)
  - Region: `MINIO_REGION` (default: us-east-1)
  - Public URL: `MINIO_PUBLIC_URL` (for browser-reachable URLs)
  - Client: `minio` 8.0.3
  - Implementation: `apps/web/lib/minio.ts`
  - Bucket policy: Anonymous read access limited to `variants/*` prefix only
  - Usage:
    - Presigned PUT URLs for direct browser uploads to MinIO
    - Original photo storage (server-side processing)
    - Variant storage: thumb (256px), medium (1024px), large (2048px) — all WebP format
    - Path structure: `{photoId}` for originals, `variants/{photoId}/{size}.webp` for processed variants
    - Lifecycle: Originals processed and variants generated via job queue, variants served to clients
  - CORS: Configured via `MINIO_CORS_ORIGINS` (default: https://snackspot.online)

**Caching:**
- Redis 7 (in-memory data store)
  - Connection: `REDIS_URL` (default: redis://redis:6379)
  - Client: `ioredis` 5.4.1
  - Usage patterns:
    - Job queue backing store (BullMQ)
    - Rate limiting cache (token bucket, request counting)
    - Session cache (optional, based on auth flow)
  - Configuration: Alpine image with maxmemory 256MB, LRU eviction policy, RDB persistence (save 60 1)
  - Implementation: `apps/web/lib/redis.ts`
  - Global singleton pattern with singleton memoization for development

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Implementation: Manual JWT creation/verification in web and admin apps
  - Tokens:
    - Access token: Short-lived (default 15 minutes), stored in secure HTTP-only cookie
    - Refresh token: Long-lived (default 7 days), stored in secure HTTP-only cookie
  - Secrets: `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (minimum 32 characters each)
  - Cookie secure flag: `AUTH_COOKIE_SECURE` (true in production, false for local HTTP)
  - Package: `jsonwebtoken` 9.0.2
  - Password hashing: `argon2` 0.41.1 (memory-hard password hashing)

**Session Management:**
- Middleware-based authentication in `apps/web/middleware.ts`
- Cookie-based session persistence
- CORS validation per `CORS_ORIGINS` env var

## Monitoring & Observability

**Error Tracking:**
- Not detected - No external error tracking service configured

**Logs:**
- Pino structured logging (`pino` 9.6.0)
- Format: JSON in production, pretty-printed in development (via `pino-pretty`)
- Log level: Configurable via `LOG_LEVEL` env var (default: info in production)
- Output: stdout (Docker friendly)
- Usage: Redis connection events, Turnstile verification failures, email send errors, worker job processing

## CI/CD & Deployment

**Hosting:**
- Docker-based deployment
- Services: web (Next.js app on port 3000), admin (Next.js app on port 3001), worker (async processor), migrate (schema migrations)
- Init: All services use `init: true` (tini process manager)
- Health checks: All services implement health check endpoints or commands
- Resource limits: Memory caps and CPU quotas per service
- Security: Read-only filesystem with tmpfs for application cache

**CI Pipeline:**
- Not detected - No explicit CI service configured in analysis
- Nginx reverse proxy expected (implied by infra comments)

## Environment Configuration

**Required env vars:**
- Database: `DATABASE_URL`, `POSTGRES_PASSWORD`
- Redis: `REDIS_URL`
- MinIO: `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_PUBLIC_URL`, `MINIO_REGION`
- Auth: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- External APIs: `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`
- Public URLs: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (site key is public, set at build time)

**Secrets location:**
- Environment variables (docker-compose references `.env` file)
- All sensitive values prefixed as required: API keys, secrets, passwords
- `pg` password synchronized between `POSTGRES_PASSWORD` and `DATABASE_URL`

## Webhooks & Callbacks

**Incoming:**
- Resend email delivery webhooks - Not detected (web hooks not implemented in codebase)
- Health check endpoints:
  - `GET /api/health/ready` (web app) - Returns 200 if service is ready
  - Health checks for admin and worker via health check commands in docker-compose.yml

**Outgoing:**
- Email sending via Resend API (transactional, no webhooks)
- Job queue workers consume jobs from Redis queue (BullMQ Worker pattern)
- Nominatim geocoding requests (stateless API calls, no callbacks)

## Image Processing Pipeline

**Worker Application:**
- Async job processor in `apps/worker/src/index.ts`
- Job queue: BullMQ worker consuming from `photo-processing` queue
- Flow:
  1. User uploads photo → job enqueued via `apps/web/lib/queue.ts`
  2. Worker downloads original from MinIO
  3. Sharp processes image: re-encodes to WebP, strips EXIF metadata, generates 3 variants
  4. Uploads variants back to MinIO under `variants/{photoId}/{size}.webp`
  5. Updates Photo record in Prisma with variant keys and metadata
- Job retry: 3 attempts with exponential backoff (5s initial delay)
- Constraints:
  - Max original file size: `MAX_FILE_SIZE_BYTES` (default 10MB)
  - Max input pixels: 40 million (prevents memory exhaustion on malformed images)
  - Concurrency: 3 parallel jobs (configurable via `WORKER_CONCURRENCY`)
  - Variant specs: thumb 256px, medium 1024px, large 2048px (all WebP quality 80-90)

---

*Integration audit: 2026-04-06*
