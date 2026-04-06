# Codebase Concerns

**Analysis Date:** 2026-04-06

## Tech Debt

**Large, monolithic page components:**
- Issue: Several client components exceed 900 lines of code with complex state management and multiple responsibilities
- Files: `apps/web/app/(app)/add-review/page.tsx` (956 lines), `apps/web/components/ui/map.tsx` (932 lines), `apps/web/app/(app)/profile/page.tsx` (762 lines), `apps/web/app/review/[id]/edit/page.tsx` (636 lines)
- Impact: Difficult to test, maintain, and reason about. Risk of regressions when modifying state logic or UI sections. Complex prop drilling and state management makes refactoring error-prone.
- Fix approach: Break into smaller, focused components. Extract state management hooks into custom hooks. Consider moving complex logic to utility functions with dedicated tests. Start with add-review page which has geolocation, file upload, form state, and search logic intermingled.

**Email service missing test coverage:**
- Issue: Email generation (`apps/web/lib/email.ts`, 584 lines) lacks unit tests despite complex template rendering and HTML escaping logic
- Files: `apps/web/lib/email.ts`
- Impact: HTML injection vulnerabilities could be introduced without detection. Template changes risk breaking email layouts in production. User-data escaping correctness unknown.
- Fix approach: Add comprehensive unit tests for email template rendering. Test HTML escaping with special characters, XSS attempts, and malformed user data. Validate template structure and CSS rendering in Jest.

**Minimal test coverage for core features:**
- Issue: Only 10 test files across entire monorepo despite significant complexity in auth, uploads, reviews, and badge logic
- Files: Tests only in `apps/web/lib/*.test.ts` (10 files total)
- Impact: Regression risk high when refactoring. No safety net for critical paths like auth flows, token rotation, or badge calculation. Integration between services untested.
- Fix approach: Prioritize unit tests for auth-related modules (`lib/auth.ts`), badge service (`lib/badge-service.ts`), token rotation logic, and rating calculations. Add integration tests for photo upload pipeline (initiate → upload → confirm).

## Known Bugs

**Database migration with CONCURRENTLY syntax issue (resolved):**
- Symptoms: Migration creation would fail on PostgreSQL when index operations used `CONCURRENTLY` keyword
- Files: `packages/db/migrations/` - fixed in recent commit `109eba3`
- Trigger: Running migrations in environments with strict PostgreSQL configuration
- Workaround: Previous migrations already fixed; no current issue but indicates migration process vulnerability

**NextJS Vary header stripping in Cloudflare caching (resolved):**
- Symptoms: Improper cache headers causing stale content to be served for authenticated vs public requests
- Files: Nginx configuration updated in commit `6ca9f30`
- Trigger: Requests routed through Cloudflare edge
- Workaround: Already fixed in infrastructure; no current impact

## Security Considerations

**Environment variable exposure in development:**
- Risk: DATABASE_URL, JWT secrets, MinIO credentials, and API keys are required in .env for local development. If .env.local is accidentally committed, secrets are exposed.
- Files: `apps/web/lib/env.ts`, `apps/admin/lib/env.ts`, `apps/worker/src/index.ts`
- Current mitigation: .gitignore exists; env validation at startup catches missing vars
- Recommendations: Implement pre-commit hooks to prevent .env* files from staging. Add validation to ensure JWT_ACCESS_SECRET and JWT_REFRESH_SECRET meet minimum entropy requirements (currently only check length >= 32 chars). Consider using a secrets management tool for CI/CD.

**Nominatim API calls without rate limiting in add-review form:**
- Risk: Client-side geolocation reverse geocoding calls Nominatim (OpenStreetMap) without client token. At scale, requests could be rate-limited or IP-banned, breaking location feature for all users from that IP.
- Files: `apps/web/app/(app)/add-review/page.tsx` (lines 237, hardcoded https://nominatim.openstreetmap.org)
- Current mitigation: Manual 1-second delay between requests; User-Agent header set
- Recommendations: Implement server-side reverse geocoding proxy to batch requests and add proper rate limiting. Consider using Mapbox Geocoding API (Maplibre already integrated for maps). Add fallback when Nominatim unavailable (currently logs error but silently continues).

**File upload validation incomplete:**
- Risk: Only MIME type checked client-side and in initiate-upload route; magic byte validation missing from confirm-upload flow. Malicious files with spoofed MIME types could bypass image processing validation.
- Files: `apps/web/app/(app)/add-review/page.tsx` (lines 366-369 MIME alias mapping), `apps/web/lib/magic-bytes.test.ts` exists but usage unclear
- Current mitigation: Worker process uses sharp's `limitInputPixels` to reject malformed images; EXIF stripped automatically
- Recommendations: Enforce magic byte validation in photo confirm-upload route (`apps/web/app/api/v1/photos/confirm-upload/route.ts`). Add strict file extension validation. Implement file size re-check at upload confirmation (client could have modified size in initiate call).

**Password reset tokens not invalidated on password change:**
- Risk: If user requests password reset but doesn't complete it, the token remains valid. If user later changes password directly (via settings), the old reset token could still be used to reset to old password (potential race condition).
- Files: `packages/db/prisma/schema.prisma` (PasswordResetToken model), `apps/web/app/api/v1/auth/reset-password/route.ts`
- Current mitigation: Token has 24-hour expiry; used tokens marked with usedAt timestamp
- Recommendations: Add invalidate-all-reset-tokens endpoint called when user changes password through normal flow. Consider shortening reset token TTL to 15 minutes. Add user IP/device fingerprint to tokens to detect reuse attempts.

**Refresh token family detection for theft could be improved:**
- Risk: Refresh token rotation uses family-based detection (all tokens from same login session share family ID). If attacker steals old token before rotation is used, detection window is 10 minutes. Legitimate concurrent requests could trigger false positive ban.
- Files: `apps/worker/src/index.ts` (lines 182-193 token cleanup logic), `apps/web/app/api/v1/auth/refresh/route.ts` (grace period comment)
- Current mitigation: 5-minute grace period for concurrent requests before marking as theft; tokens logged with jobId for audit trail
- Recommendations: Implement device fingerprinting to add confidence to theft detection (if token from different IP/device, less likely to be concurrent retry). Store last-used timestamp and ban if same family used from multiple IPs within 1 minute. Log suspected theft events for manual review.

## Performance Bottlenecks

**N+1 query risk in notification and badge systems:**
- Problem: Notification creation triggers badge checks; badge progress updates query user's recent activity. If multiple notifications created together, could trigger many database queries.
- Files: `apps/web/lib/badge-service.ts` (line count unclear from grep), badge earning logic scattered across routes
- Cause: Badge calculation not batched; each notification may trigger separate activity queries
- Improvement path: Batch badge checks per user per day. Cache badge criteria values in-memory or Redis. Defer badge calculation to async queue (use BullMQ like photo processing). Query user's activity once instead of per-notification.

**Map component event handlers re-bind on every render:**
- Problem: `apps/web/components/ui/map.tsx` (932 lines) has complex useCallback and useEffect dependency arrays that may not be fully optimized
- Files: `apps/web/components/ui/map.tsx` (lines not fully reviewed)
- Cause: MapLibre GL handlers could be recreating on state changes, causing unnecessary re-renders of child components
- Improvement path: Audit all useCallback dependencies in map component. Memoize marker/popup elements. Consider extracting map logic to custom hook to isolate state changes.

**Email sending not queued, synchronous in request/response cycle:**
- Problem: Notification emails sent directly in route handlers, blocking response
- Files: `apps/web/lib/notification-service.ts`, `apps/web/lib/email.ts` (584 lines)
- Cause: Email API calls (Resend) are await-ed in request handler
- Improvement path: Move email sending to BullMQ queue (reuse photo-processing queue infrastructure). Implement retry logic for transient failures. Add monitoring for failed email sends.

**Database indexes for search queries:**
- Problem: Full-text search on dish_name uses GIN index; other common search filters (by rating, by user) may lack optimal indexes
- Files: `packages/db/prisma/schema.prisma` (Review model indexes), `packages/db/migrations/023_dish_name_search_index.sql`
- Cause: Indexes created ad-hoc as queries discovered; may miss combinations
- Improvement path: Analyze query logs for sequential scans. Add composite indexes for common filter combinations (e.g., place_id + status + rating + createdAt for sorting reviews by rating). Use EXPLAIN ANALYZE on slow queries in test data.

## Fragile Areas

**Token rotation grace period logic:**
- Files: `apps/web/app/api/v1/auth/refresh/route.ts` (grace period for concurrent requests mentioned), `apps/worker/src/index.ts` (cleanup cutoffs)
- Why fragile: Multiple timeouts (10 min cleanup window, 5 min grace period) are hardcoded in different files. Changing one without the other breaks theft detection.
- Safe modification: Create shared constants file `apps/web/lib/token-constants.ts` with TOKEN_CLEANUP_WINDOW_MS, TOKEN_GRACE_PERIOD_MS, TOKEN_FAMILY_RETENTION_MS. Export from one place. Add comments explaining relationship between values.
- Test coverage: Test refresh with concurrent requests from same tab (should succeed), concurrent requests from different tabs (first wins, second gets rotated), and token reuse after grace period (should fail).

**Photo moderation status state machine:**
- Files: `packages/db/prisma/schema.prisma` (PhotoModerationStatus enum), `apps/worker/src/index.ts` (processPhoto function), API routes for photo confirmation
- Why fragile: States are PENDING → PROCESSING → APPROVED/REJECTED. Worker assumes PENDING means "never processed"; if confirmation route crashes after update, photo stuck in PROCESSING. No timeout or retry for stuck processing jobs.
- Safe modification: Add processedAt timestamp check before processing (skip if already processed). Implement stuck-job detection in worker: if photo PROCESSING for >1 hour, re-queue it. Add periodic job to find orphaned photos and set back to PENDING for retry.
- Test coverage: Test job failure mid-variant generation (photo should be re-processable). Test concurrent confirm requests (one should win, second should fail gracefully).

**Review edit transaction complexity:**
- Files: `apps/web/app/api/v1/reviews/[id]/route.ts` (transaction with review + reviewTag + reviewPhoto updates)
- Why fragile: Single Prisma transaction updates review, deletes old tags, creates new tags, deletes old photos, creates new photos. If any step fails midway, state is inconsistent. Rollback works but requires careful ordering of deleteMany/createMany calls.
- Safe modification: Break into logical steps with intermediate commits if safe (e.g., update review first, then manage tags/photos separately). Add uniqueness constraint validation before transaction. Log transaction start/end for debugging.
- Test coverage: Test editing review to add/remove/reorder photos. Test adding/removing tags. Test concurrent edit attempts (second should fail with conflict).

**Geolocation and reverse geocoding fallback paths:**
- Files: `apps/web/app/(app)/add-review/page.tsx` (lines 215-298 geolocation, hardcoded Nominatim URL)
- Why fragile: Multiple error paths (no geolocation API, reverse geocoding fails, network timeout) have different fallbacks. User experience varies based on which path is taken. Silent coordinate-only fallback could lead to wrong address if user doesn't notice.
- Safe modification: Add explicit UI state for each geolocation step (fetching coords → reverse geocoding → display result). Show success/warning UI for partial success (coords but no address). Implement server-side reverse geocoding with better error handling and fallback provider (Mapbox).
- Test coverage: Mock navigator.geolocation in tests. Mock Nominatim with slow/timeout responses. Test address normalization (road + house_number + city extraction).

**Blocked words moderation system incomplete:**
- Files: `packages/db/prisma/schema.prisma` (BlockedWord, FlaggedComment models), API routes for comment review
- Why fragile: Comment flagged when matched word found, but moderator review is manual. No automation for removing repeated offenders' comments. No notification system for offending user. Created word list has no validation (could add typos or overly broad terms).
- Safe modification: Add moderation action logging when flagged comment is approved/rejected. Implement auto-removal of repeated flagged comments from same user (3+ in 24h). Add word list validation (minimum length, no partial word matches, UI for bulk import with preview).
- Test coverage: Test comment with multiple blocked words (should flag once). Test word boundary matching (word "cat" should not match "category"). Test concurrent moderation of same flagged comment.

## Scaling Limits

**BullMQ worker concurrency capped at 5:**
- Current capacity: Processing up to 5 photos concurrently with 1GB worker memory and 3 variant generations per photo
- Limit: Each variant generation can use up to 200MB memory (sharp with large images); max 15 variants in flight = ~1.5GB memory pressure
- Scaling path: Implement worker pool auto-scaling based on queue depth (increase WORKER_CONCURRENCY env var in production compose). Move to larger VM memory if queue backlog grows. Consider offloading sharp processing to Lambda/serverless (scale to zero during off-peak).

**Redis connection pool configuration:**
- Current capacity: Single Redis instance with default ioredis settings; connection pooling via PgBouncer on database side but no explicit Redis pool config visible
- Limit: Production may hit Redis connection limits under high notification/badge activity (refresh tokens, rate limiting, cache all use Redis)
- Scaling path: Add connection pool configuration to Redis client (`maxRetriesPerRequest: null` already set; consider `enableReadyCheck: false` for lower latency). Implement Redis Sentinel for failover. Consider Redis Cluster if write throughput bottleneck found.

**Database connection pooling via PgBouncer:**
- Current capacity: PgBouncer pooler in front of PostgreSQL; typical pool size ~20-50 connections
- Limit: Each app instance may grab multiple connections during peak load; with horizontal scaling, pool exhaustion possible
- Scaling path: Increase PgBouncer pool size gradually and monitor active connections. Implement statement pooling mode if not already used. Add database query monitoring to identify slow queries blocking connections. Consider read replicas for report/analytics queries that currently hit primary.

**Single MinIO instance without replication:**
- Current capacity: One MinIO server storing all user photos and variants
- Limit: Disk space, upload throughput, and recovery time if disk fails
- Scaling path: Implement MinIO replication or upgrade to MinIO erasure-coded deployment. Add S3 cold storage tier for old photos. Implement image retention policy (delete photos after 2 years of inactivity). Monitor MinIO disk usage and add alerting at 80%.

## Dependencies at Risk

**Maplibre GL pinned to older version:**
- Risk: `apps/web/components/ui/map.tsx` imports from "maplibre-gl" with complex event handling; breaking changes in major versions could affect marker/popup rendering
- Impact: Updates to Maplibre may require UI refactoring. Performance fixes available in newer versions not applied.
- Migration plan: Review Maplibre changelog for 1.x → 2.x if applicable. Pin version explicitly in package.json. Create isolated test of map rendering with multiple markers/popups before upgrading. Consider extracting map wrapper to separate package for easier testing.

**Resend email service API dependency:**
- Risk: Hardcoded to Resend (apps/web/lib/email.ts); if Resend API changes or has outages, all notification emails fail silently
- Impact: Users won't receive important notifications (comments on reviews, badge earned, mentions). No fallback to alternative email provider.
- Migration plan: Create email provider abstraction layer (interface for send function). Implement fallback to AWS SES or SendGrid. Add retry queue with exponential backoff in BullMQ. Implement email bouncing detection and logging.

**Sharp for image processing:**
- Risk: Sharp is C++ native binding; updates may have binary incompatibility or performance regressions
- Impact: Photo processing jobs could fail during deployment if binary not rebuilt for new architecture
- Migration plan: Lock sharp version in package-lock.json. Test photo processing with edge cases (very large HEIC files, corrupted JPEGs) after updates. Monitor worker processing time; if regression detected, rollback.

**Zod schema validation tight coupling:**
- Risk: Zod schemas used throughout codebase for validation but deeply integrated into route handlers; if Zod API changes, many files need updates
- Impact: Major Zod update could require refactoring many validation calls
- Migration plan: Already using `safeParse` pattern consistently. Extract common schemas to shared package (`@snackspot/shared`). Create wrapper functions for validation to isolate Zod usage.

## Missing Critical Features

**No rate limiting on API endpoints:**
- Problem: Routes vulnerable to brute force (auth), spam (reviews, comments), or resource exhaustion (large list queries)
- Blocks: Can't scale to production load safely. Vulnerable to DDoS at app layer.
- Current: Rate limiting only on admin login route; web API endpoints unprotected
- Recommendation: Implement rate limiting middleware for all API routes. Use Redis-backed sliding window with per-IP and per-user limits. Add different limits for authenticated vs public endpoints. Return 429 with Retry-After header.

**No image moderation automation:**
- Problem: All photos manually reviewed as PENDING → APPROVED/REJECTED; at scale, moderation backlog grows
- Blocks: Photo galleries show unreviewed content to users. Inappropriate images visible until manually reviewed.
- Current: Manual review dashboard exists but no automation for obvious violations
- Recommendation: Integrate Google Vision API or AWS Rekognition for auto-flagging explicit content. Chain API result to moderator review queue. Log confidence score for audit trail.

**No audit logging for sensitive operations:**
- Problem: No centralized audit trail for moderation actions, password changes, role changes, or token rotation
- Blocks: Can't investigate security incidents or user complaints about data access
- Current: ModerationAction table exists but not comprehensive (missing auth, password, token events)
- Recommendation: Implement audit log table with actor, action, target, timestamp, IP/device. Log to separate system (e.g., Datadog, Sentry) for retention. Create admin UI to search audit logs.

**No GDPR/data deletion feature:**
- Problem: Users can't request deletion of their data; compliance risk
- Blocks: Non-compliant with GDPR right to be forgotten. Can be legal liability.
- Current: User deletion logic likely exists but not exposed in UI
- Recommendation: Add data deletion request flow (request → verification email → 30-day delay → automatic deletion). Implement hard delete for PII (email, avatar). Consider anonymization for review content (set username to "Deleted User", keep review for historical data).

## Test Coverage Gaps

**Email service generation untested:**
- What's not tested: HTML email template rendering, subject line generation, HTML escaping of user-supplied data (usernames, dish names)
- Files: `apps/web/lib/email.ts` (584 lines, no corresponding .test.ts file)
- Risk: HTML injection (XSS in email clients), broken template layout, missing fallback text bodies
- Priority: High — security and presentation risks

**Photo upload pipeline untested:**
- What's not tested: Multi-step upload process (initiate → upload → confirm); error handling at each step; concurrent uploads from same user; cleanup of failed uploads
- Files: `apps/web/app/(app)/add-review/page.tsx` (upload logic), API routes for upload initiation/confirmation
- Risk: Orphaned photo records, UI desync with backend state, failed uploads not cleaned up
- Priority: High — frequent user action with complex state

**Badge earning logic untested:**
- What's not tested: Badge progress calculation, earning conditions, concurrent updates to progress
- Files: `apps/web/lib/badge-service.ts`, badge-related database triggers or periodic jobs
- Risk: Users earn badges unexpectedly or not at all; performance issues with badge queries
- Priority: Medium — user-facing feature but not critical to core flow

**Geolocation reverse geocoding untested:**
- What's not tested: Nominatim API response parsing, fallback when API fails, address normalization from different response formats
- Files: `apps/web/app/(app)/add-review/page.tsx` (lines 215-298)
- Risk: Wrong addresses stored, missing addresses in reviews, user confusion
- Priority: Medium — affects review creation accuracy

**Token rotation and refresh logic undertested:**
- What's not tested: Family-based theft detection logic, grace period for concurrent requests, edge cases (reused token after theft window, multiple concurrent refreshes)
- Files: `apps/web/app/api/v1/auth/refresh/route.ts`, `apps/admin/app/api/auth/refresh/route.ts`
- Risk: Legitimate users locked out due to false positive theft detection, or theft undetected
- Priority: High — security-critical

**Comment moderation word matching untested:**
- What's not tested: Word boundary matching, case sensitivity, special characters in blocked words
- Files: FlaggedComment logic, blocked word matching implementation
- Risk: False positives/negatives, bypasses (e.g., "c@t" for word "cat"), inconsistent behavior
- Priority: Medium — moderation feature

---

*Concerns audit: 2026-04-06*
