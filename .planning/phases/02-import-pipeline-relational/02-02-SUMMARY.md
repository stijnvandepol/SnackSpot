---
phase: 02-import-pipeline-relational
plan: 02
subsystem: api
tags: [import, zip, unzipper, prisma, postgis, id-remapping, duplicate-detection, transaction]

# Dependency graph
requires:
  - phase: 02-import-pipeline-relational
    plan: 01
    provides: unzipper dependency, ImportSummary/IdMaps/remap helpers, IMPORT_TABLE_ORDER, CURRENT_SCHEMA_VERSION
  - phase: 01-foundation-export-pipeline
    provides: export ZIP format with manifest.json and data/*.json structure
provides:
  - POST /api/import handler that accepts ZIP upload and imports all 18 tables
  - Full atomic import pipeline with FK-ordered inserts, ID remapping, and duplicate detection
affects: [02-import-pipeline-relational plan 03 (UI — calls this endpoint)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - pre-flight validation (all 18 JSON files parsed before transaction opens)
    - dedup maps pre-loaded outside transaction (users by email, places by name+address, badges by slug, photos by storageKey)
    - FK remap with remapRequired (non-nullable) and remap (nullable) helpers
    - PostGIS ST_MakePoint(lng, lat) via Prisma tagged template literal for safe parameterization
    - Junction tables via createMany with skipDuplicates
    - Single Prisma transaction with 60s timeout for full atomicity

key-files:
  created:
    - apps/admin/app/api/import/route.ts
  modified: []

key-decisions:
  - "All 18 JSON files parsed and validated BEFORE the transaction opens — zero partial DB writes on bad input"
  - "Dedup maps loaded outside the transaction to minimize TX duration while still providing accurate dedup"
  - "Place raw SQL uses Prisma tagged template literals (not string concat) — prevents SQL injection per T-02-03"
  - "tableStats and idMaps declared outside the transaction callback so they stay accessible for error reporting"

# Metrics
duration: 12min
completed: 2026-04-06
---

# Phase 02 Plan 02: Import API Route Summary

**Full 18-table ZIP import POST handler with pre-flight validation, dedup maps, FK ordering, ID remapping, and atomic Prisma transaction**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-06T13:07:14Z
- **Completed:** 2026-04-06
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Created `apps/admin/app/api/import/route.ts` — 509-line POST handler for the full import pipeline
- Implemented pre-flight validation: manifest.json presence, schemaVersion equality check, all 18 data JSON files parsed and array-verified before any DB writes
- Built four dedup lookup maps loaded before the transaction: users (email, case-insensitive), places (name::address), badges (slug), photos (storageKey)
- All 18 table importers inside a single `db.$transaction()` call with `timeout: 60000` for full atomicity
- FK dependency order strictly followed (IMPORT_TABLE_ORDER from types.ts): users -> places -> reviews -> photos -> review-photos -> comments -> badges -> user-badges -> review-likes -> favorites -> reports -> moderation-actions -> notifications -> notification-preferences -> review-mentions -> review-tags -> blocked-words -> flagged-comments
- Non-nullable FKs use `remapRequired()` (throws on missing mapping); nullable FKs use `remap()` (returns null)
- PostGIS place inserts use `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography` via Prisma tagged template literals (safe parameterization)
- Junction tables (review-photos, user-badges, review-likes, favorites, notification-preferences, review-tags) use `createMany({ skipDuplicates: true })`
- Full ImportSummary response with per-table imported/skipped/errors counts
- Error handling: transaction rolls back on any error; returns success:false ImportSummary with Dutch error message
- All user-facing error messages in Dutch per D-03

## Task Commits

1. **Task 1 + Task 2: Complete import API route** - `446c4a5` (feat) — validation layer and all 18 table importers written together in a single atomic file

## Files Created/Modified

- `apps/admin/app/api/import/route.ts` — POST handler: auth guard, ZIP parse, manifest validation, 18 JSON file parse, 4 dedup maps, single Prisma transaction with all 18 table importers, ImportSummary response

## Decisions Made

- Pre-flight parse of all 18 files before transaction: fails fast with clear error if any file is missing/malformed, preventing partial writes
- Dedup maps loaded outside transaction: avoids `tx.user.findMany()` inside the long-running TX, reduces lock time
- Prisma tagged template literals for PostGIS raw SQL: safe against SQL injection per T-02-03 threat mitigation
- `tableStats` and `idMaps` declared before `db.$transaction()` call: remains accessible in the outer catch block for potential future error enrichment

## Deviations from Plan

None - plan executed exactly as written. Tasks 1 and 2 were implemented as a single cohesive file since they both target the same file (`route.ts`) and Task 2 fills in the placeholder from Task 1. Committed as one atomic commit with all 509 lines.

## Known Stubs

None - this plan implements the full import pipeline with no placeholder data or TODO stubs.

## Threat Flags

All threats mitigated as planned:
- T-02-01: `requireAdmin(req)` at handler entry — line 49
- T-02-02: Pre-flight validation of manifest + 18 files before any DB writes — lines 67-105
- T-02-03: PostGIS raw SQL uses Prisma tagged template literals, not string concatenation — line 195
- T-02-05: Transaction `timeout: 60000, maxWait: 10000` — line 493
- T-02-06: Generic Dutch error messages returned on failure — lines 89, 499-507

## Self-Check: PASSED

- `apps/admin/app/api/import/route.ts` exists and is 509 lines
- Commit `446c4a5` exists in git history
- All 18 table importers present (verified via grep)
- ST_MakePoint with correct lng/lat order verified
- All 6 junction tables use skipDuplicates: true

---
*Phase: 02-import-pipeline-relational*
*Completed: 2026-04-06*
