# SnackSpot Technical Specification

## 1. Product Definition
SnackSpot is a location-aware review platform for snacks and meals. Users publish reviews with rating, text, photos, and place context. The core experience combines a real-time feed, nearby discovery by radius, and detailed place pages with review history. Search supports places, dishes, and users. Profiles show reputation and review activity. The UX is mobile-first with desktop parity.

## 2. UX / UI

### Information architecture
- Feed
- Nearby
- Search
- Add Review flow
- Place detail
- Review detail
- User profile + settings
- Auth (login/register/forgot/reset)
- Admin moderation

### Navigation
- Mobile: bottom nav with 5 tabs (Feed, Nearby, Search, Add, Profile)
- Desktop: top nav + side filters

### Screen behavior
- Feed: newest reviews, infinite scroll, sort chips, skeleton and retry states
- Nearby: map + list split, radius slider (0.5–25km), location permission handling
- Search: unified input, result tabs, ranking by relevance and distance
- Add Review: 7-step wizard with per-step validation and preview
- Place detail: summary header, photo grid, sortable reviews
- Review detail: full text, photo carousel, report action
- Profile/settings: account info, privacy controls, GDPR actions
- Moderation: queue, triage, action execution with reason required

## 3. Data model and storage
- PostgreSQL 16 + PostGIS
- UUID primary keys
- Soft deletion for user generated content
- Geographic point storage as geography(Point,4326)
- FTS via tsvector + GIN

### Core tables
users, refresh_tokens, places, place_sources, reviews, photos, review_photos, tags, review_tags, bookmarks, reports, moderation_actions

## 4. Media handling
- No image blobs in SQL
- S3-compatible object storage
- Presigned direct upload
- Confirm endpoint triggers processing queue
- Sharp re-encodes to WebP, strips EXIF, creates variants (thumb/medium/large)
- Metadata only in DB

## 5. API design
- Versioned REST under /api/v1
- Cursor-based pagination for feed and place review streams
- Zod schema validation for write endpoints
- Uniform error envelope with status-specific messages

## 6. Geo search
- ST_DWithin for radius filter
- ST_Distance for ordered distance result
- Default radius 3000m, max 25000m
- Place dedupe by near distance + trigram name similarity

## 7. Security defaults
- Argon2id password hashing
- Short access JWT + rotating refresh token cookie
- CSRF token strategy when cookie auth used
- RBAC and ownership checks
- Helmet, strict CORS, secure cookies
- Rate limiting on sensitive endpoints
- Audit logs for moderation operations

## 8. Stack decision
- Web: Next.js App Router + Tailwind + TypeScript
- API: Fastify + TypeScript
- DB: PostgreSQL + PostGIS
- Queue/cache: Redis
- Storage: MinIO/S3-compatible
- Image pipeline: Sharp worker

Alternative: Vite + React + NestJS.

## 9. Monorepo structure
- apps/web
- apps/api
- apps/worker
- packages/shared
- packages/db
- infra/docker
- infra/nginx
- docs

## 10. Deployment and operations
- Docker Compose for local and small-scale host deployments
- Env separation dev/staging/prod
- Migration-first deployment
- Daily backups with retention policy
- Structured logs and basic metrics endpoint
- Optional Sentry integration

## 11. MVP rollout
- Sprint 1: auth, profile basics, places and geo
- Sprint 2: reviews and feed
- Sprint 3: photo pipeline + moderation report
- Sprint 4: search and favorites polish
