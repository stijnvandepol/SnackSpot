---
phase: 01-foundation-export-pipeline
plan: "02"
subsystem: export-api
tags: [export, streaming, zip, archiver, minio, postgis, prisma]
dependency_graph:
  requires: [admin-minio-client, admin-archiver-dep]
  provides: [streaming-export-endpoint]
  affects: [01-03-export-ui]
tech_stack:
  added: []
  patterns: [streaming-zip-response, postgis-raw-sql, decimal-number-conversion, minio-object-streaming]
key_files:
  created:
    - apps/admin/app/api/export/route.ts
  modified: []
decisions:
  - "rawPlaces map callback typed inline to avoid implicit any when @prisma/client not generated"
  - "reviews map callback uses eslint-disable for explicit any fallback pending Prisma generation"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-06T10:40:33Z"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 01 Plan 02: Streaming ZIP Export API Route Summary

**One-liner:** GET /api/export streams a ZIP archive of all 18 non-token tables + photos via archiver PassThrough, with PostGIS ST_Y/ST_X serialization and Decimal-to-number conversion.

## What Was Built

Created `apps/admin/app/api/export/route.ts` — a streaming Next.js API route that:

- Guards access with `requireAdmin(req)` (returns 401/403 before any DB query)
- Creates an archiver ZIP stream piped through a Node.js `PassThrough` stream, bridged to the Web Streams API via `Readable.toWeb(pass)`
- Exports all 18 non-token tables as `data/*.json` files: users, places, reviews, photos, review-photos, comments, badges, user-badges, review-likes, favorites, reports, moderation-actions, notifications, notification-preferences, review-mentions, review-tags, blocked-words, flagged-comments
- Excludes RefreshToken, PasswordResetToken, EmailVerificationToken (D-07)
- Serializes PostGIS `Place.location` (geography(Point,4326)) as `{lat, lng}` objects using `$queryRaw` with `ST_Y`/`ST_X`
- Converts Prisma `Decimal` rating fields to `Number()`, including nullable `ratingService`
- Streams original photos sequentially from MinIO into `photos/{storageKey}` (D-11, D-12)
- Skips missing photos with a console.error (continuing the export)
- Writes `manifest.json` at ZIP root with `schemaVersion: 1`, `exportedAt`, `tables`, `counts`, `photosCount`, `photosSkipped`
- Sets `Content-Type: application/zip` and `Content-Disposition: attachment; filename="snackspot-export-{timestamp}.zip"`
- Does NOT await `buildExport()` in the GET handler — streaming starts immediately

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create streaming export API route with all 18 tables serialized | bea22cc | apps/admin/app/api/export/route.ts |

## Decisions Made

1. **Inline type annotation for rawPlaces map** — The `p` parameter in the `rawPlaces.map()` callback was annotated inline with an explicit type to avoid `implicit any` errors when `@prisma/client` is not yet generated. The `$queryRaw<Array<{...}>>` generic provides the actual shape at runtime.

2. **eslint-disable for reviews map** — The `rawReviews.map((r: any) => ...)` uses an explicit `any` annotation with a comment explaining this is a fallback for the ungenerated Prisma client environment. At runtime with `pnpm db:generate`, `r` will be properly typed as `Review`.

## Deviations from Plan

None — plan executed exactly as written. The inline type annotation additions are necessary correctness adjustments for TypeScript strict mode when `@prisma/client` types are not yet generated (pre-existing environment constraint noted in 01-01 SUMMARY).

## Known Stubs

None. The export route is fully wired: auth guard, DB queries, photo streaming, manifest, and streaming response all implemented.

## Threat Surface Scan

New network endpoint introduced: `GET /api/export` in admin app.

| Flag | File | Description |
|------|------|-------------|
| threat_flag: auth-guarded-endpoint | apps/admin/app/api/export/route.ts | New GET endpoint — mitigated by requireAdmin() guard per T-01-01; no DB access before auth check |

This endpoint was planned and covered by the threat model in the plan's `<threat_model>` section. All STRIDE mitigations applied as specified:
- T-01-01: requireAdmin() guard at handler top — implemented
- T-01-03: Token tables excluded — db.refreshToken/passwordResetToken/emailVerificationToken not referenced
- T-01-05: photo.storageKey comes from DB, not user input — no path traversal possible
- T-01-06: Streaming archiver used (not in-memory buffer) — PassThrough + archiver pattern

## Self-Check: PASSED

- [x] apps/admin/app/api/export/route.ts exists (247 lines)
- [x] Contains `export const runtime = 'nodejs'`
- [x] Contains `export async function GET(req: NextRequest)`
- [x] Contains `requireAdmin(req)` auth guard
- [x] Contains `archiver('zip', { zlib: { level: 6 } })`
- [x] Contains `Readable.toWeb(pass)`
- [x] Contains `ST_Y(location::geometry) AS lat` for PostGIS
- [x] Contains `Number(r.rating)` and all 5 other Decimal conversions
- [x] Contains `archive.finalize()`
- [x] Contains `manifest.json` append
- [x] Contains `schemaVersion: 1`
- [x] Contains `photos/${photo.storageKey}`
- [x] Contains `Content-Disposition` header with `snackspot-export`
- [x] Contains `Content-Type: application/zip`
- [x] 18 `archive.append` calls for `data/*.json`
- [x] Zero references to refreshToken/passwordResetToken/emailVerificationToken
- [x] Commit bea22cc exists
- [x] No new TypeScript errors introduced (pre-existing @prisma/client errors are env-only)
