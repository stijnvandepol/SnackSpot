# Technology Stack

**Analysis Date:** 2026-04-06

## Languages

**Primary:**
- TypeScript 5.7.3 - All application code (web, admin, worker, shared packages)
- JavaScript - Configuration files (next.config.mjs, postcss.config.mjs)

**Secondary:**
- SQL - PostgreSQL database queries via Prisma ORM
- HTML/CSS - Email templates and styling

## Runtime

**Environment:**
- Node.js 20.0.0+ - Server runtime for web, admin, and worker applications

**Package Manager:**
- pnpm 9.15.4+ - Monorepo package manager
- Lockfile: pnpm-lock.yaml (present)

## Frameworks

**Core:**
- Next.js 15.1.6 - Full-stack React framework for `apps/web` and `apps/admin`
- React 19.0.0 - UI component library

**Styling:**
- Tailwind CSS 3.4.17 - Utility-first CSS framework
- PostCSS 8.5.1 - CSS transformation pipeline

**Database:**
- Prisma 5.22.0 - ORM for PostgreSQL database access
- PostgreSQL 16 (PostGIS 3.4) - Primary database with geospatial extensions

**Job Queue:**
- BullMQ 5.34.6 - Redis-based job queue for async image processing
- Redis 7 - In-memory cache and queue backing store

**File Storage:**
- MinIO 2025-09-07 - S3-compatible object storage for user-uploaded photos
- Sharp 0.33.5 - Image processing (resize, format conversion, EXIF stripping)

**Testing:**
- Vitest 2.1.9 - Unit test framework for web app
- TypeScript test utilities (type checking during tests)

**Build/Dev:**
- tsx 4.19.2 - TypeScript execution for worker development
- Autoprefixer 10.4.20 - CSS vendor prefix generation
- Turbo - Monorepo task orchestration (implied by pnpm workspaces)

## Key Dependencies

**Critical:**
- `@prisma/client` 5.22.0 - Database client for all apps
- `ioredis` 5.4.1 - Redis client (used in web, admin, worker)
- `minio` 8.0.3 - MinIO S3 client for photo storage
- `bullmq` 5.34.6 - Redis job queue processor

**Authentication & Security:**
- `jsonwebtoken` 9.0.2 - JWT token creation and verification
- `argon2` 0.41.1 - Password hashing (used in web and admin)

**External Services:**
- `resend` 6.9.3 - Email sending service SDK
- `@marsidev/react-turnstile` 1.5.0 - Cloudflare Turnstile CAPTCHA client

**Utilities:**
- `zod` 3.23.8 - Schema validation and environment variable parsing
- `clsx` 2.1.1 - Conditional className concatenation
- `tailwind-merge` 3.5.0 - Tailwind CSS class merging utilities
- `lucide-react` 0.577.0 - Icon library
- `maplibre-gl` 5.19.0 - OpenStreetMap web mapping library

**Infrastructure:**
- `pino` 9.6.0 - Structured JSON logging
- `pino-pretty` 13.0.0 - Development-friendly log formatting
- `pg` 8.13.0 - PostgreSQL native driver (used for migrations)

## Configuration

**Environment:**
- Environment variables validated via Zod at runtime in `apps/web/lib/env.ts`
- Required vars: DATABASE_URL, REDIS_URL, MINIO_* (5 vars), JWT_* (4 vars), RESEND_API_KEY, TURNSTILE_SECRET_KEY
- Optional vars: NODE_ENV (defaults to development), LOG_LEVEL, CORS_ORIGINS, AUTH_COOKIE_SECURE
- Public vars prefixed with `NEXT_PUBLIC_` are available in browser context

**Build:**
- `next.config.mjs` - Next.js configuration with image optimization, CSP headers, webpack externals
- `tsconfig.json` - TypeScript strict mode configuration per app
- `vitest.config.ts` - Vitest configuration for unit tests
- `tailwind.config.ts` - Tailwind CSS customization (colors, spacing)

**Docker:**
- `docker-compose.yml` - Complete local development stack with 6 services
- `Dockerfile` files for web, admin, worker, and migrate services
- PgBouncer 1.24.0-p1 - Connection pooling for PostgreSQL

## Platform Requirements

**Development:**
- Node.js 20.0.0 or higher
- pnpm 9.0.0 or higher
- Docker and Docker Compose (for local PostgreSQL, Redis, MinIO)
- System memory: minimum 2GB (PostgreSQL 512MB + Redis 256MB + MinIO 512MB + app 2GB)

**Production:**
- Node.js 20.0.0 or higher
- PostgreSQL 16+ with PostGIS extension
- Redis 7+
- MinIO or S3-compatible object storage
- Memory: 2GB for web app, 512MB for admin, 1GB for worker
- Cloudflare Turnstile account for bot protection
- Resend account for transactional email
- CORS and reverse proxy configuration (Nginx expected based on infra comments)

---

*Stack analysis: 2026-04-06*
