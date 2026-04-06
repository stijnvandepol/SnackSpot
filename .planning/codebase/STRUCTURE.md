# Codebase Structure

**Analysis Date:** 2026-04-06

## Directory Layout

```
SnackSpot/
├── apps/
│   ├── web/                               # Next.js 15 main app (frontend + REST API v1)
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── health/                # Health check endpoints
│   │   │   │   │   ├── live/route.ts
│   │   │   │   │   └── ready/route.ts
│   │   │   │   └── v1/                    # REST API v1 endpoints (45+ routes)
│   │   │   │       ├── auth/              # Authentication (login, register, refresh)
│   │   │   │       ├── me/                # Current user endpoints
│   │   │   │       ├── places/            # Place search, details, reviews
│   │   │   │       ├── reviews/           # Create, update, like, comment on reviews
│   │   │   │       ├── photos/            # Upload initiation, confirmation, variants
│   │   │   │       ├── users/             # User search, profiles
│   │   │   │       ├── badges/            # Badge retrieval
│   │   │   │       ├── notifications/     # Notification management
│   │   │   │       ├── comments/          # Comment endpoints
│   │   │   │       ├── reports/           # Report/moderation
│   │   │   │       ├── mod/               # Moderator actions
│   │   │   │       ├── avatar/            # Avatar endpoints
│   │   │   │       ├── feed/              # Feed endpoint
│   │   │   │       ├── discover/          # Featured places
│   │   │   │       └── admin/             # Admin endpoints
│   │   │   ├── (app)/                     # Authenticated route group
│   │   │   │   ├── page.tsx               # Feed (home)
│   │   │   │   ├── search/                # Place search page
│   │   │   │   ├── nearby/                # Geolocation-based discovery
│   │   │   │   ├── feed/                  # Feed page
│   │   │   │   ├── profile/               # User profile page
│   │   │   │   └── add-review/            # Review creation form
│   │   │   ├── auth/                      # Unauthenticated route group
│   │   │   │   ├── page.tsx               # Login/register page
│   │   │   │   └── forgot-password/       # Password reset flow
│   │   │   ├── place/[id]/                # Public place detail page
│   │   │   ├── review/[id]/               # Public review detail page
│   │   │   ├── u/[username]/              # Public user profile page
│   │   │   ├── admin/                     # Admin-only pages
│   │   │   ├── guides/                    # Help/guide content
│   │   │   ├── product/                   # Product pages
│   │   │   ├── releases/                  # Release notes
│   │   │   ├── layout.tsx                 # Root layout with providers
│   │   │   ├── globals.css                # Global styles
│   │   │   ├── manifest.ts                # PWA manifest
│   │   │   ├── robots.ts                  # Robots.txt
│   │   │   └── sitemap.ts                 # Sitemap for SEO
│   │   ├── components/                    # Reusable React components
│   │   │   ├── auth-provider.tsx          # Auth state management context
│   │   │   ├── theme-provider.tsx         # Dark mode provider
│   │   │   ├── feed-client.tsx            # Feed pagination component
│   │   │   ├── place-card.tsx             # Place card display
│   │   │   ├── review-card.tsx            # Review card with interactions
│   │   │   ├── place-map.tsx              # Map integration (MapLibre GL)
│   │   │   ├── notification-*.tsx         # Notification UI components
│   │   │   ├── user-mention-input.tsx     # @mention input for reviews
│   │   │   ├── image-lightbox.tsx         # Photo gallery
│   │   │   ├── top-nav.tsx                # Header navigation
│   │   │   ├── bottom-nav.tsx             # Mobile bottom navigation
│   │   │   ├── pull-to-refresh.tsx        # Pull-to-refresh gesture
│   │   │   └── ui/                        # Headless UI primitives (buttons, inputs, etc.)
│   │   ├── lib/                           # Server-side utilities
│   │   │   ├── api-helpers.ts             # Response builders, auth extraction, body/query parsing
│   │   │   ├── auth.ts                    # JWT signing/verification, Argon2 hashing, token generation
│   │   │   ├── db.ts                      # Prisma client singleton
│   │   │   ├── redis.ts                   # Redis client singleton
│   │   │   ├── queue.ts                   # BullMQ queue singleton
│   │   │   ├── minio.ts                   # MinIO S3-compatible client
│   │   │   ├── rate-limit.ts              # Sliding-window rate limiting
│   │   │   ├── badge-service.ts           # Badge calculation and awarding logic
│   │   │   ├── notification-service.ts    # Create notifications, send emails
│   │   │   ├── email.ts                   # Email template generation (Resend)
│   │   │   ├── place-search.ts            # SQL query builders for place search
│   │   │   ├── review-helpers.ts          # Review business logic (validation, filtering)
│   │   │   ├── user-stats.ts              # User statistics calculation
│   │   │   ├── cache.ts                   # Redis cache helpers
│   │   │   ├── upload.ts                  # Photo upload validation and metadata
│   │   │   ├── magic-bytes.ts             # MIME type validation from file headers
│   │   │   ├── mentions.ts                # @mention parsing and validation
│   │   │   ├── html.ts                    # HTML sanitization
│   │   │   ├── blocked-words.ts           # Profanity filtering
│   │   │   ├── logger.ts                  # Pino logger configuration
│   │   │   ├── env.ts                     # Environment variable schema and parsing
│   │   │   ├── turnstile.ts               # Cloudflare Turnstile CAPTCHA verification
│   │   │   └── *.test.ts                  # Unit tests (auth.test.ts, rate-limit.test.ts, etc.)
│   │   ├── middleware.ts                  # CORS, host validation, request logging
│   │   ├── public/                        # Static assets (icons, favicon, images)
│   │   ├── next.config.mjs                # Next.js build configuration
│   │   ├── tailwind.config.ts             # Tailwind CSS configuration
│   │   ├── tsconfig.json                  # TypeScript configuration (extends base)
│   │   ├── package.json                   # Dependencies and scripts
│   │   └── Dockerfile                     # Production container image
│   │
│   ├── admin/                             # Next.js 14 admin dashboard (port 3001)
│   │   ├── app/
│   │   │   ├── api/                       # Admin-only API endpoints
│   │   │   │   ├── auth/                  # Admin login/refresh
│   │   │   │   ├── users/                 # User management (search, ban, update)
│   │   │   │   ├── reviews/               # Review moderation
│   │   │   │   ├── places/                # Place management
│   │   │   │   ├── reports/               # Moderation report handling
│   │   │   │   ├── comments/flagged/      # Flagged comment management
│   │   │   │   └── stats/                 # Admin statistics
│   │   │   ├── dashboard/                 # Admin dashboard pages
│   │   │   │   ├── page.tsx               # Dashboard overview
│   │   │   │   ├── users/                 # User list and detail views
│   │   │   │   ├── reviews/               # Review moderation queue
│   │   │   │   ├── places/                # Place management
│   │   │   │   ├── reports/               # Moderation reports
│   │   │   │   ├── comments/              # Comment management
│   │   │   │   └── marketing/             # Marketing email tools
│   │   │   ├── layout.tsx                 # Admin layout with auth check
│   │   │   └── page.tsx                   # Redirect to dashboard
│   │   ├── lib/                           # Admin utilities
│   │   ├── middleware.ts                  # Auth check for /dashboard routes
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   └── worker/                            # BullMQ background worker (Node.js process)
│       ├── src/
│       │   └── index.ts                   # Photo processing worker
│       ├── Dockerfile                     # Worker container image
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── db/                                # Prisma database package
│   │   ├── prisma/
│   │   │   └── schema.prisma              # Data model (User, Place, Review, Photo, Badge, etc.)
│   │   ├── migrations/                    # SQL migration files (20+ migrations)
│   │   ├── scripts/
│   │   │   ├── migrate.mjs                # Migration runner
│   │   │   └── seed.mjs                   # Database seed script
│   │   └── package.json
│   │
│   ├── shared/                            # Shared validation schemas and types
│   │   ├── src/
│   │   │   └── index.ts                   # Zod schemas (RegisterSchema, LoginSchema, CreateReviewSchema, etc.)
│   │   └── package.json
│   │
│   └── ui/                                # Shared React UI components
│       ├── src/
│       │   ├── index.ts                   # Barrel export
│       │   └── star-rating.tsx            # Star rating component
│       └── package.json
│
├── infra/
│   ├── docker/
│   │   ├── docker-compose.yml             # Full stack: web, admin, worker, postgres, redis, minio, migrate
│   │   └── Dockerfile.migrate             # One-off migration image
│   └── nginx/
│       └── *.conf                         # Optional reverse proxy configuration
│
├── docs/                                  # Documentation files
├── .github/                               # GitHub actions CI/CD
├── .env.example                           # Environment variable template
├── tsconfig.base.json                     # Base TypeScript configuration for all packages
├── pnpm-workspace.yaml                    # Workspace configuration
├── package.json                           # Root package.json with workspace scripts
└── README.md                              # Project documentation
```

## Directory Purposes

**apps/web:**
- Purpose: Main production application — frontend pages, REST API, business logic
- Contains: Next.js 15 with App Router, React 19 components, all server utilities
- Key files: `app/layout.tsx` (root), `app/(app)/page.tsx` (authenticated home), `app/api/v1/*` (API routes), `lib/*` (services)

**apps/admin:**
- Purpose: Separate admin/moderator dashboard for content moderation and user management
- Contains: Role-gated dashboard UI, admin-only API endpoints
- Key files: `app/dashboard/page.tsx` (overview), `app/api/auth/*` (admin login), `middleware.ts` (role check)

**apps/worker:**
- Purpose: Background job worker for asynchronous image processing
- Contains: Single entry point that starts BullMQ worker listening on Redis
- Key files: `src/index.ts` (worker logic, photo processing pipeline)

**packages/db:**
- Purpose: Centralized database schema and migrations
- Contains: Prisma schema with all models, SQL migration files
- Key files: `prisma/schema.prisma` (schema), `migrations/*` (SQL), `scripts/seed.mjs` (seed data)

**packages/shared:**
- Purpose: Shared validation schemas and types across apps
- Contains: Zod schemas for all API requests/responses
- Key files: `src/index.ts` (all schemas: RegisterSchema, CreateReviewSchema, PlaceSearchSchema, etc.)

**packages/ui:**
- Purpose: Reusable React components shared between web and admin apps
- Contains: Minimal UI components (star rating, etc.)
- Key files: `src/star-rating.tsx` (component)

## Key File Locations

**Entry Points:**

- `apps/web/app/layout.tsx` — Root layout with ThemeProvider, AuthProvider, CookieConsent
- `apps/web/app/(app)/page.tsx` — Authenticated home page (feed)
- `apps/web/app/auth/page.tsx` — Login/register page
- `apps/web/app/api/health/live/route.ts` — Liveness probe
- `apps/worker/src/index.ts` — Background worker startup

**Configuration:**

- `apps/web/lib/env.ts` — Runtime environment variable validation with Zod
- `apps/web/middleware.ts` — Global middleware (CORS, host validation)
- `apps/admin/middleware.ts` — Admin route protection
- `.env.example` — Required environment variables template
- `tsconfig.base.json` — TypeScript compiler options for entire monorepo
- `pnpm-workspace.yaml` — Workspace package configuration

**Core Logic:**

- `apps/web/lib/auth.ts` — JWT signing/verification, password hashing, refresh token generation
- `apps/web/lib/api-helpers.ts` — API response builders, auth extraction, body/query parsing
- `apps/web/lib/badge-service.ts` — Badge calculation and awarding logic
- `apps/web/lib/notification-service.ts` — Notification creation and email sending
- `apps/web/lib/rate-limit.ts` — Sliding-window rate limiting with Redis
- `apps/web/lib/place-search.ts` — PostGIS place search SQL builders

**Testing:**

- `apps/web/lib/auth.test.ts` — JWT and password tests
- `apps/web/lib/rate-limit.test.ts` — Rate limiting tests
- `apps/web/lib/badge-service.test.ts` — Badge calculation tests
- `apps/web/lib/upload.test.ts` — Photo upload validation tests
- `apps/web/vitest.config.ts` — Test runner configuration

## Naming Conventions

**Files:**

- Kebab-case for component files: `auth-provider.tsx`, `place-card.tsx`, `review-interactions.tsx`
- Kebab-case for utility files: `api-helpers.ts`, `rate-limit.ts`, `badge-service.ts`
- `.test.ts` suffix for unit tests: `auth.test.ts`, `upload.test.ts`
- `route.ts` for Next.js API route handlers (fixed name required by framework)
- `page.tsx` for Next.js page components (fixed name required by framework)
- `layout.tsx` for Next.js layout components (fixed name required by framework)
- `middleware.ts` for middleware (fixed name required by framework)

**Directories:**

- Lowercase with hyphens: `apps/web`, `packages/db`, `apps/admin`
- Route groups in parentheses: `(app)`, following Next.js convention
- Dynamic segments in brackets: `[id]`, `[username]`, following Next.js convention
- Feature-grouped API routes: `api/v1/auth/`, `api/v1/places/`, `api/v1/reviews/`

**Functions/Exports:**

- camelCase for functions: `getAuthPayload()`, `parseBody()`, `requireAuth()`
- PascalCase for React components: `AuthProvider`, `PlaceCard`, `ReviewCard`
- SCREAMING_SNAKE_CASE for constants: `MAX_FILE_SIZE_BYTES`, `VARIANTS`, `JWT_ISSUER`
- Descriptive action verbs: `create*`, `update*`, `delete*`, `fetch*`, `send*` (e.g., `createNotifications()`, `sendEmailNotifications()`)

## Where to Add New Code

**New Feature (e.g., new API endpoint):**
1. Define Zod schema in `packages/shared/src/index.ts`
2. Create route handler: `apps/web/app/api/v1/[feature]/route.ts`
3. Implement business logic in `apps/web/lib/[feature].ts` if complex
4. Add tests: `apps/web/lib/[feature].test.ts`
5. Update frontend component to call endpoint (via `useAuth()` context and `fetch()`)

**New Page/Feature UI:**
1. Create page file: `apps/web/app/[feature]/page.tsx` or `apps/web/app/(app)/[feature]/page.tsx`
2. Create layout if needed: `apps/web/app/[feature]/layout.tsx`
3. Create component(s): `apps/web/components/[feature-name].tsx`
4. Leverage existing components from `apps/web/components/` and `packages/ui/`

**New Database Model:**
1. Add model to `packages/db/prisma/schema.prisma`
2. Create migration: `pnpm --filter @snackspot/db migrate` generates SQL file in `packages/db/migrations/`
3. Run migration: applies to database
4. Import generated types in routes via `import type { ModelName } from '@prisma/client'`

**Utility/Service Logic:**
- Shared server logic: `apps/web/lib/[name].ts`
- Complex calculations: `apps/web/lib/[feature]-service.ts`
- Type-only exports: `packages/shared/src/index.ts`

**UI Components:**
- Reusable across web + admin: `packages/ui/src/[name].tsx`
- Web-only components: `apps/web/components/[name].tsx`
- Admin-only components: `apps/admin/app/dashboard/[name].tsx` or `apps/admin/lib/components/`

## Special Directories

**apps/web/public/:**
- Purpose: Static assets served by Next.js
- Generated: Some assets may be auto-generated (favicon, PWA icons)
- Committed: Yes (static files tracked in git)

**apps/web/app/api/v1/:**
- Purpose: REST API namespace for v1
- Generated: No
- Committed: Yes
- Pattern: Each route is a directory with `route.ts` file; supports dynamic segments `[id]`, query parameters, and nested paths

**packages/db/migrations/:**
- Purpose: SQL migration history for database schema
- Generated: Yes (by Prisma when running `prisma migrate dev`)
- Committed: Yes (essential for reproducible database state)

**packages/db/scripts/:**
- Purpose: One-off database operations (migrations, seeding)
- Generated: No
- Committed: Yes

**.env files:**
- Purpose: Runtime configuration (never committed)
- Generated: No (copied from `.env.example`)
- Committed: No (listed in `.gitignore`)
- Template location: `.env.example` (shows all required variables)

---

*Structure analysis: 2026-04-06*
