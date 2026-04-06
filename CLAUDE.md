<!-- GSD:project-start source:PROJECT.md -->
## Project

**SnackSpot — Admin Export/Import**

An export and import feature for the SnackSpot admin panel that allows administrators to download a complete backup of all application data (including photos) as a ZIP archive, and import that archive into a new or existing instance with full data validation and relationship preservation.

**Core Value:** A complete, validated data transfer between instances — every record, every relationship, every photo — without data loss or corruption.

### Constraints

- **Tech stack**: Must use existing Next.js API routes in admin app, Prisma for DB access, MinIO client for photos
- **Auth**: All endpoints must use existing `requireAdmin()` middleware
- **ZIP size**: Large instances may produce multi-GB archives — needs streaming approach, not in-memory
- **PostGIS**: Geography data needs special handling (not standard JSON serializable)
- **Import order**: Tables must be imported in dependency order (users before reviews, places before reviews, etc.)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.7.3 - All application code (web, admin, worker, shared packages)
- JavaScript - Configuration files (next.config.mjs, postcss.config.mjs)
- SQL - PostgreSQL database queries via Prisma ORM
- HTML/CSS - Email templates and styling
## Runtime
- Node.js 20.0.0+ - Server runtime for web, admin, and worker applications
- pnpm 9.15.4+ - Monorepo package manager
- Lockfile: pnpm-lock.yaml (present)
## Frameworks
- Next.js 15.1.6 - Full-stack React framework for `apps/web` and `apps/admin`
- React 19.0.0 - UI component library
- Tailwind CSS 3.4.17 - Utility-first CSS framework
- PostCSS 8.5.1 - CSS transformation pipeline
- Prisma 5.22.0 - ORM for PostgreSQL database access
- PostgreSQL 16 (PostGIS 3.4) - Primary database with geospatial extensions
- BullMQ 5.34.6 - Redis-based job queue for async image processing
- Redis 7 - In-memory cache and queue backing store
- MinIO 2025-09-07 - S3-compatible object storage for user-uploaded photos
- Sharp 0.33.5 - Image processing (resize, format conversion, EXIF stripping)
- Vitest 2.1.9 - Unit test framework for web app
- TypeScript test utilities (type checking during tests)
- tsx 4.19.2 - TypeScript execution for worker development
- Autoprefixer 10.4.20 - CSS vendor prefix generation
- Turbo - Monorepo task orchestration (implied by pnpm workspaces)
## Key Dependencies
- `@prisma/client` 5.22.0 - Database client for all apps
- `ioredis` 5.4.1 - Redis client (used in web, admin, worker)
- `minio` 8.0.3 - MinIO S3 client for photo storage
- `bullmq` 5.34.6 - Redis job queue processor
- `jsonwebtoken` 9.0.2 - JWT token creation and verification
- `argon2` 0.41.1 - Password hashing (used in web and admin)
- `resend` 6.9.3 - Email sending service SDK
- `@marsidev/react-turnstile` 1.5.0 - Cloudflare Turnstile CAPTCHA client
- `zod` 3.23.8 - Schema validation and environment variable parsing
- `clsx` 2.1.1 - Conditional className concatenation
- `tailwind-merge` 3.5.0 - Tailwind CSS class merging utilities
- `lucide-react` 0.577.0 - Icon library
- `maplibre-gl` 5.19.0 - OpenStreetMap web mapping library
- `pino` 9.6.0 - Structured JSON logging
- `pino-pretty` 13.0.0 - Development-friendly log formatting
- `pg` 8.13.0 - PostgreSQL native driver (used for migrations)
## Configuration
- Environment variables validated via Zod at runtime in `apps/web/lib/env.ts`
- Required vars: DATABASE_URL, REDIS_URL, MINIO_* (5 vars), JWT_* (4 vars), RESEND_API_KEY, TURNSTILE_SECRET_KEY
- Optional vars: NODE_ENV (defaults to development), LOG_LEVEL, CORS_ORIGINS, AUTH_COOKIE_SECURE
- Public vars prefixed with `NEXT_PUBLIC_` are available in browser context
- `next.config.mjs` - Next.js configuration with image optimization, CSP headers, webpack externals
- `tsconfig.json` - TypeScript strict mode configuration per app
- `vitest.config.ts` - Vitest configuration for unit tests
- `tailwind.config.ts` - Tailwind CSS customization (colors, spacing)
- `docker-compose.yml` - Complete local development stack with 6 services
- `Dockerfile` files for web, admin, worker, and migrate services
- PgBouncer 1.24.0-p1 - Connection pooling for PostgreSQL
## Platform Requirements
- Node.js 20.0.0 or higher
- pnpm 9.0.0 or higher
- Docker and Docker Compose (for local PostgreSQL, Redis, MinIO)
- System memory: minimum 2GB (PostgreSQL 512MB + Redis 256MB + MinIO 512MB + app 2GB)
- Node.js 20.0.0 or higher
- PostgreSQL 16+ with PostGIS extension
- Redis 7+
- MinIO or S3-compatible object storage
- Memory: 2GB for web app, 512MB for admin, 1GB for worker
- Cloudflare Turnstile account for bot protection
- Resend account for transactional email
- CORS and reverse proxy configuration (Nginx expected based on infra comments)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Lowercase with hyphens for separators: `badge-service.ts`, `api-helpers.ts`, `rate-limit.ts`
- Test files use `.test.ts` suffix: `auth.test.ts`, `ratings.test.ts`
- React components use PascalCase: `page.tsx`, `layout.tsx`
- API routes follow Next.js convention: `route.ts` for endpoint handlers, `[id]` for dynamic segments
- camelCase for all function names: `hashRefreshToken()`, `generateTokenFamily()`, `parseQuery()`, `rateLimitIP()`
- Descriptive verb-noun pattern: `buildSetCookie()`, `normalizeAvatarKey()`, `computeOverallRating()`
- Helper functions use verb prefixes: `get*`, `parse*`, `build*`, `require*`, `is*`
- camelCase for local variables and parameters: `segments`, `lastIndex`, `activitySnapshot`
- UPPER_SNAKE_CASE for constants: `RESET_TOKEN_BYTES`, `JWT_ISSUER`, `USERNAME_MIN`, `MS_PER_DAY`
- Meaningful names reflecting domain concepts: `tokenFamily`, `refreshToken`, `activitySnapshot` (not `data`, `temp`)
- PascalCase for interfaces and types: `AccessTokenPayload`, `RatingInput`, `NormalizedRatings`, `MentionSegment`
- Suffixes indicate type purpose: `Schema` (Zod), `Payload` (JWT/API), `Options` (function options), `Snapshot` (immutable data)
- Union types documented with comments: `type MentionSegment = | { type: 'text'; value: string } | { type: 'mention'; ... }`
## Code Style
- No explicit linter/formatter config detected (not using Prettier or ESLint as strict requirements)
- 2-space indentation (observed in all source files)
- Lines generally under 100 characters
- Imports grouped: external packages first, then local imports
- Inline comments document non-obvious logic, especially security-sensitive code:
- Section separators use comment lines with `─` for file organization:
- No JSDoc required for simple functions; detailed docstrings used for complex behavior
- Comments placed above code or inline with explanation of "why" not "what"
- Always use async/await over promise chaining
- Sequential operations: `const result = await operation()`
- Parallel operations: `const [a, b, c] = await Promise.all([...])`
- Error-safe operations: `.catch(() => null)` for optional operations
## Import Organization
- `@/*` resolves to app root (configured in `tsconfig.json`)
- Use `@/lib/` for utilities: `@/lib/auth`, `@/lib/api-helpers`
- Use `@/` for same-directory relative imports when crossing module boundaries
- Avoid relative paths like `../../../` — use alias instead
## Error Handling
- Early returns with null/Response for validation failure:
- Promise rejections caught with `.catch()`:
- Explicit error types in try/catch:
- API errors follow pattern: `err(message: string, status: number, details?: unknown): Response`
- Business logic errors raised as exceptions; API layer catches and logs
- Context logged in errors: `logger.error({ err: error, context }, 'Internal server error')`
## Logging
- Central logger instance exported: `export const logger = pino({...})`
- Level defaults to 'debug' in development, 'info' in production (controlled by `LOG_LEVEL` env var)
- Sensitive paths automatically redacted (passwords, tokens, cookies, auth headers)
- Pretty printing enabled in development via `pino-pretty`
- Used for error logging in API routes: `logger.error({ err, context }, 'message')`
- Example: `logger.error({ err: error, context }, 'Internal server error')`
- Only allowed in startup validation before logger is available
- Marked with `// eslint-disable-next-line no-console` when used
## Validation
- All incoming data validated via Zod: `CreateReviewSchema`, `PlaceSearchSchema`
- Schemas defined in `@snackspot/shared` package for shared types
- Safe parsing used for API inputs: `schema.safeParse(raw)`
- Validation errors returned as 422 with details:
- Environment variables validated at startup:
## Function Design
- Prefer focused functions under 30 lines
- Extract helpers for complex operations: `normalizeAvatarKey()`, `streamToBuffer()`, `progressForCriteria()`
- Limit parameters to 3-4; use options objects for more:
- Type imports/params explicitly: `req: NextRequest`, `schema: { safeParse(...) }`
- Return type explicitly annotated: `Promise<AccessTokenPayload>`, `string | null`, `Response | T`
- Union returns for error handling: `AccessTokenPayload | Response`
- Null for optional results: `await minioClient.getObject(...).catch(() => null)`
## Module Design
- Named exports for functions: `export function hashPassword(...)`
- Default exports only for modules with single primary export (rarely used)
- Export interfaces/types alongside functions: `export interface AccessTokenPayload`
- Const exports for constants: `export const REFRESH_COOKIE = 'snackspot_rt'`
- One module per semantic concern: `auth.ts`, `ratings.ts`, `badge-service.ts`
- Related types exported from same file: `RatingInput`, `NormalizedRatings` in `ratings.ts`
- Utilities organized by function: `/lib/api-helpers.ts` contains all response builders
- Shared package uses barrel exports: `@snackspot/shared` exports schemas and types
- Web app imports from shared: `import { CreateReviewSchema } from '@snackspot/shared'`
## Code Organization in Test Files
- Organized with visual comment separators for readability:
- Groups related test suites logically
- Comments explain "why" tests exist before test blocks
- Interfaces defined at top of files when needed
- Type guards implemented as pure functions (not requiring mocks):
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Next.js App Router for full-stack application (pages + API routes in single codebase)
- Shared database schema across web app and worker via Prisma ORM
- Separate admin application with role-based access control
- Background image processing worker for photo uploads with variant generation
- Shared validation schemas (Zod) across frontend and API
- JWT-based authentication with httpOnly refresh token cookies
- Redis for caching, rate limiting, and job queue
## Layers
- Purpose: Server-side rendered React pages using Next.js App Router with client-side hydration
- Location: `apps/web/app/(app)/`, `apps/web/app/auth/`, `apps/web/app/place/`, `apps/web/app/review/`, `apps/web/app/u/[username]/`
- Contains: Page components, layout files, loading states, metadata generation
- Depends on: Prisma (database queries), Auth utilities, Components library
- Used by: Browser clients
- Purpose: REST API endpoints for frontend and external clients
- Location: `apps/web/app/api/v1/` (user management, reviews, places, notifications), `apps/web/app/api/health/`
- Contains: Route handlers that parse requests, validate with Zod, execute business logic, return JSON
- Depends on: Prisma, Auth, Redis, MinIO, Rate limiting, Email service
- Used by: Frontend (fetch requests), Mobile clients
- Purpose: Separate authenticated dashboard for moderators and admins
- Location: `apps/admin/app/dashboard/`, `apps/admin/app/api/`
- Contains: Admin UI pages and admin-only API endpoints with role checks
- Depends on: Same database and auth system as main app
- Used by: Administrators only (role-based routing)
- Purpose: Core business logic and infrastructure integration utilities
- Location: `apps/web/lib/`
- Contains: Auth helpers (JWT, password hashing, token rotation), database client, Redis client, file storage (MinIO), email service, rate limiting, badge calculation, notification management
- Depends on: External libraries (jsonwebtoken, argon2, ioredis, @prisma/client)
- Used by: API routes and page components
- Purpose: Data model definition and migrations
- Location: `packages/db/prisma/schema.prisma`, `packages/db/migrations/`
- Contains: Prisma schema with 15+ models (User, Place, Review, Photo, Badge, Notification, etc.)
- Depends on: PostgreSQL with PostGIS extension
- Used by: Web app, admin, worker
- Purpose: Shared Zod schemas and TypeScript types across frontend and API
- Location: `packages/shared/src/index.ts`
- Contains: Request/response schemas (auth, places, reviews, pagination), type exports
- Depends on: Zod library
- Used by: API route handlers for input validation, frontend for form validation
- Purpose: Reusable React components shared across apps
- Location: `packages/ui/src/`
- Contains: Star rating component and other shared UI primitives
- Depends on: React 19
- Used by: Web app, admin app
- Purpose: Asynchronous image processing and file management
- Location: `apps/worker/src/index.ts`
- Contains: BullMQ worker that listens for photo processing jobs
- Depends on: Prisma (update Photo records), Redis (job queue), MinIO (S3-compatible storage), Sharp (image processing)
- Used by: API routes that enqueue photo processing jobs
## Data Flow
- Authentication state: React Context (`AuthProvider` in `@/components/auth-provider`) — synced via `/api/v1/auth/me`, refreshed via `/api/v1/auth/refresh`
- User preferences (theme, notifications): Stored in browser localStorage
- Notification state: Real-time polling via `/api/v1/me/notifications` (NOT WebSocket)
- Feed/search results: Client-side React state with cursor-based pagination
## Key Abstractions
- Purpose: Standardized HTTP response formatting
- Examples: `ok<T>()`, `err()`, `created<T>()`, `validationError()` in `@/lib/api-helpers`
- Pattern: All API routes use these helpers to ensure consistent response structure `{ data: T }` or `{ error: string }`
- Purpose: Extract and validate auth tokens from requests
- Examples: `getAuthPayload()`, `requireAuth()`, `requireRole()` in `@/lib/api-helpers`
- Pattern: Returns either `AccessTokenPayload` or a `Response` (early-return error)
- Purpose: Sliding-window rate limiting using Redis counters
- Examples: `rateLimitIP()`, `rateLimit()` in `@/lib/rate-limit`
- Pattern: Redis keys store request counts with expiry; per-IP and per-user limits prevent abuse
- Purpose: Compute user badges based on activity criteria
- Examples: `awardEligibleBadges()` in `@/lib/badge-service`
- Pattern: Reads user stats, checks against badge criteria (post count, location count, streak days), awards new badges
- Purpose: Create and manage user notifications (in-app + email)
- Examples: `createNotifications()`, `sendEmailNotifications()` in `@/lib/notification-service`
- Pattern: Creates DB records for in-app notifications; enqueues async email sending via BullMQ
- Purpose: Multi-step upload with confirmation and background processing
- Steps:
## Entry Points
- Location: `apps/web/app/layout.tsx`, `apps/web/app/(app)/page.tsx`
- Triggers: User navigates to `/`
- Responsibilities: Render root layout with theme/auth providers; render authenticated feed or redirect to auth
- Location: `apps/web/app/api/health/live/route.ts`, `apps/web/app/api/health/ready/route.ts`
- Triggers: Kubernetes/Docker health probes
- Responsibilities: `/health/live` returns 200 if process running; `/health/ready` checks database connectivity
- Location: `apps/worker/src/index.ts`
- Triggers: Enqueued BullMQ job in Redis
- Responsibilities: Process photo jobs: download, convert to WebP, generate variants, upload, update database
- Location: `apps/admin/app/layout.tsx`, `apps/admin/app/dashboard/page.tsx`
- Triggers: Admin user navigates to admin app (port 3001)
- Responsibilities: Render admin UI, enforce role-based access, show stats/moderation queue
## Error Handling
- **Validation errors (422):** Request body/query fails Zod schema validation; returns `{ error: 'Validation error', details: ZodError.flatten() }`
- **Auth errors (401/403):** Missing/invalid token or insufficient role; returns `{ error: 'Unauthorized' }` or `{ error: 'Forbidden' }`
- **Rate limit errors (429):** Too many requests; returns `{ error: 'Too many ... attempts' }`
- **Not found (404):** Resource doesn't exist; handled by Next.js `notFound()` for pages, returns `{ error: '...' }` for API
- **Server errors (500):** Unexpected error during processing; logs full error with context via `logger.error()`, returns generic `{ error: 'Internal server error' }`
```typescript
```
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
