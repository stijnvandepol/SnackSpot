# Architecture

**Analysis Date:** 2026-04-06

## Pattern Overview

**Overall:** Monorepo with layered server-side rendered application (Next.js) + asynchronous background job processing (BullMQ worker).

**Key Characteristics:**
- Next.js App Router for full-stack application (pages + API routes in single codebase)
- Shared database schema across web app and worker via Prisma ORM
- Separate admin application with role-based access control
- Background image processing worker for photo uploads with variant generation
- Shared validation schemas (Zod) across frontend and API
- JWT-based authentication with httpOnly refresh token cookies
- Redis for caching, rate limiting, and job queue

## Layers

**Frontend/Pages Layer:**
- Purpose: Server-side rendered React pages using Next.js App Router with client-side hydration
- Location: `apps/web/app/(app)/`, `apps/web/app/auth/`, `apps/web/app/place/`, `apps/web/app/review/`, `apps/web/app/u/[username]/`
- Contains: Page components, layout files, loading states, metadata generation
- Depends on: Prisma (database queries), Auth utilities, Components library
- Used by: Browser clients

**API Layer:**
- Purpose: REST API endpoints for frontend and external clients
- Location: `apps/web/app/api/v1/` (user management, reviews, places, notifications), `apps/web/app/api/health/`
- Contains: Route handlers that parse requests, validate with Zod, execute business logic, return JSON
- Depends on: Prisma, Auth, Redis, MinIO, Rate limiting, Email service
- Used by: Frontend (fetch requests), Mobile clients

**Admin Layer:**
- Purpose: Separate authenticated dashboard for moderators and admins
- Location: `apps/admin/app/dashboard/`, `apps/admin/app/api/`
- Contains: Admin UI pages and admin-only API endpoints with role checks
- Depends on: Same database and auth system as main app
- Used by: Administrators only (role-based routing)

**Service/Utility Layer:**
- Purpose: Core business logic and infrastructure integration utilities
- Location: `apps/web/lib/`
- Contains: Auth helpers (JWT, password hashing, token rotation), database client, Redis client, file storage (MinIO), email service, rate limiting, badge calculation, notification management
- Depends on: External libraries (jsonwebtoken, argon2, ioredis, @prisma/client)
- Used by: API routes and page components

**Database/ORM Layer:**
- Purpose: Data model definition and migrations
- Location: `packages/db/prisma/schema.prisma`, `packages/db/migrations/`
- Contains: Prisma schema with 15+ models (User, Place, Review, Photo, Badge, Notification, etc.)
- Depends on: PostgreSQL with PostGIS extension
- Used by: Web app, admin, worker

**Validation/Types Layer:**
- Purpose: Shared Zod schemas and TypeScript types across frontend and API
- Location: `packages/shared/src/index.ts`
- Contains: Request/response schemas (auth, places, reviews, pagination), type exports
- Depends on: Zod library
- Used by: API route handlers for input validation, frontend for form validation

**UI Component Library:**
- Purpose: Reusable React components shared across apps
- Location: `packages/ui/src/`
- Contains: Star rating component and other shared UI primitives
- Depends on: React 19
- Used by: Web app, admin app

**Worker/Background Processing:**
- Purpose: Asynchronous image processing and file management
- Location: `apps/worker/src/index.ts`
- Contains: BullMQ worker that listens for photo processing jobs
- Depends on: Prisma (update Photo records), Redis (job queue), MinIO (S3-compatible storage), Sharp (image processing)
- Used by: API routes that enqueue photo processing jobs

## Data Flow

**Authentication Flow:**
1. User submits email/password to `POST /api/v1/auth/login`
2. Route handler parses body with `LoginSchema` from `@snackspot/shared`
3. Handler verifies password using Argon2id via `@/lib/auth`
4. On success: signs JWT access token and creates refresh token in database
5. Sets httpOnly refresh token cookie and returns access token in response
6. Client stores access token in memory (AuthProvider in `@/components/auth-provider`)
7. Subsequent requests include access token in Authorization header
8. Middleware validates token on each request

**Review Creation Flow:**
1. User fills form on `app/(app)/add-review/page.tsx`
2. Form submits to `POST /api/v1/reviews` with review data and photo keys
3. API handler validates request body with `CreateReviewSchema`
4. Handler calls `prisma.review.create()` to insert review record
5. For each confirmed photo: enqueues photo processing job via BullMQ
6. Worker (`apps/worker/src/index.ts`) processes job asynchronously:
   - Downloads original image from MinIO
   - Generates WebP variants (thumb, medium, large) via Sharp
   - Uploads variants to MinIO
   - Updates Photo record with variant URLs
7. Frontend polls for photo processing status via `/api/v1/photos/variant`

**Place Search Flow:**
1. User searches for place on `app/(app)/search/page.tsx`
2. Client sends `GET /api/v1/places/search?q=...&lat=...&lng=...` with location
3. API handler validates query with `PlaceSearchSchema`
4. Handler executes SQL: `SELECT ... FROM places WHERE ST_DWithin(location, $1, $2)` (PostGIS distance query)
5. Returns paginated results with cursor for next page
6. Frontend renders place cards and loads next page on scroll

**State Management:**
- Authentication state: React Context (`AuthProvider` in `@/components/auth-provider`) — synced via `/api/v1/auth/me`, refreshed via `/api/v1/auth/refresh`
- User preferences (theme, notifications): Stored in browser localStorage
- Notification state: Real-time polling via `/api/v1/me/notifications` (NOT WebSocket)
- Feed/search results: Client-side React state with cursor-based pagination

## Key Abstractions

**API Response Builders:**
- Purpose: Standardized HTTP response formatting
- Examples: `ok<T>()`, `err()`, `created<T>()`, `validationError()` in `@/lib/api-helpers`
- Pattern: All API routes use these helpers to ensure consistent response structure `{ data: T }` or `{ error: string }`

**Authentication Guard Functions:**
- Purpose: Extract and validate auth tokens from requests
- Examples: `getAuthPayload()`, `requireAuth()`, `requireRole()` in `@/lib/api-helpers`
- Pattern: Returns either `AccessTokenPayload` or a `Response` (early-return error)

**Rate Limiting Abstraction:**
- Purpose: Sliding-window rate limiting using Redis counters
- Examples: `rateLimitIP()`, `rateLimit()` in `@/lib/rate-limit`
- Pattern: Redis keys store request counts with expiry; per-IP and per-user limits prevent abuse

**Badge Calculation Service:**
- Purpose: Compute user badges based on activity criteria
- Examples: `awardEligibleBadges()` in `@/lib/badge-service`
- Pattern: Reads user stats, checks against badge criteria (post count, location count, streak days), awards new badges

**Notification Service:**
- Purpose: Create and manage user notifications (in-app + email)
- Examples: `createNotifications()`, `sendEmailNotifications()` in `@/lib/notification-service`
- Pattern: Creates DB records for in-app notifications; enqueues async email sending via BullMQ

**Photo Upload Workflow:**
- Purpose: Multi-step upload with confirmation and background processing
- Steps:
  1. `POST /api/v1/photos/initiate-upload` — Get signed MinIO presigned URL
  2. Client uploads directly to MinIO
  3. `POST /api/v1/photos/confirm-upload` — Mark as confirmed, enqueue job
  4. Worker processes in background
  5. `GET /api/v1/photos/variant` — Poll for processed variant URLs

## Entry Points

**Web App Home:**
- Location: `apps/web/app/layout.tsx`, `apps/web/app/(app)/page.tsx`
- Triggers: User navigates to `/`
- Responsibilities: Render root layout with theme/auth providers; render authenticated feed or redirect to auth

**API Health Checks:**
- Location: `apps/web/app/api/health/live/route.ts`, `apps/web/app/api/health/ready/route.ts`
- Triggers: Kubernetes/Docker health probes
- Responsibilities: `/health/live` returns 200 if process running; `/health/ready` checks database connectivity

**Background Worker:**
- Location: `apps/worker/src/index.ts`
- Triggers: Enqueued BullMQ job in Redis
- Responsibilities: Process photo jobs: download, convert to WebP, generate variants, upload, update database

**Admin Dashboard:**
- Location: `apps/admin/app/layout.tsx`, `apps/admin/app/dashboard/page.tsx`
- Triggers: Admin user navigates to admin app (port 3001)
- Responsibilities: Render admin UI, enforce role-based access, show stats/moderation queue

## Error Handling

**Strategy:** Errors at API boundary return standardized JSON responses with status codes. Server-side errors logged to Pino. Client-side errors caught in try-catch within API route handlers.

**Patterns:**
- **Validation errors (422):** Request body/query fails Zod schema validation; returns `{ error: 'Validation error', details: ZodError.flatten() }`
- **Auth errors (401/403):** Missing/invalid token or insufficient role; returns `{ error: 'Unauthorized' }` or `{ error: 'Forbidden' }`
- **Rate limit errors (429):** Too many requests; returns `{ error: 'Too many ... attempts' }`
- **Not found (404):** Resource doesn't exist; handled by Next.js `notFound()` for pages, returns `{ error: '...' }` for API
- **Server errors (500):** Unexpected error during processing; logs full error with context via `logger.error()`, returns generic `{ error: 'Internal server error' }`

Example from `apps/web/app/api/v1/auth/login/route.ts`:
```typescript
const result = schema.safeParse(raw)
if (!result.success) {
  return validationError(result.error.flatten())
}
```

## Cross-Cutting Concerns

**Logging:** Pino logger with JSON output in production, pretty-printed in development. Configured in `@/lib/logger`. API errors logged with context via `serverError()` helper.

**Validation:** All API requests validated with Zod schemas from `@snackspot/shared`. Query parameters, request bodies, and form submissions use `parseBody()` and `parseQuery()` helpers in `@/lib/api-helpers`.

**Authentication:** JWT access tokens (short-lived, ~15 min) + refresh tokens (long-lived, stored as httpOnly cookies). Token rotation prevents token theft. Refresh token family IDs detect token reuse. Both access and refresh tokens hashed/signed.

**Authorization:** Role hierarchy (USER < MODERATOR < ADMIN) enforced by `requireRole()` in API routes. Admin endpoints check for ADMIN role; mod endpoints check for MODERATOR or ADMIN.

**CORS:** Middleware in `middleware.ts` validates origin against `CORS_ORIGINS` env var. Preflight requests handled with `Access-Control-Allow-*` headers. Same-site requests for forms checked via `requireSameOrigin()`.

**Image Processing:** Photos enqueued to BullMQ with job metadata (photoId, storageKey, uploaderId). Worker picks up, downloads from MinIO, processes with Sharp (WebP, EXIF strip, resize), uploads variants back, updates database. Failed jobs retried up to 3 times.

---

*Architecture analysis: 2026-04-06*
