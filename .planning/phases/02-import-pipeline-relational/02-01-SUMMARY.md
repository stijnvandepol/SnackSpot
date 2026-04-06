---
phase: 02-import-pipeline-relational
plan: 01
subsystem: api
tags: [unzipper, typescript, import, zip, id-remapping]

# Dependency graph
requires:
  - phase: 01-foundation-export-pipeline
    provides: export route TABLE_FILES order and schemaVersion=1 manifest format
provides:
  - unzipper dependency installed in admin app
  - Shared import type contracts (ImportSummary, ImportTableStats, IdMaps)
  - IMPORT_TABLE_ORDER constant (18 tables in FK dependency order)
  - CURRENT_SCHEMA_VERSION = 1
  - createEmptyIdMaps factory and remap/remapRequired FK helpers
affects: [02-import-pipeline-relational plan 02 (API route), 02-import-pipeline-relational plan 03 (UI)]

# Tech tracking
tech-stack:
  added: [unzipper ^0.12.3, @types/unzipper ^0.10.11]
  patterns: [type-contract-first — shared types defined before consumers, FK remap helpers co-located with IdMaps type]

key-files:
  created:
    - apps/admin/app/api/import/types.ts
  modified:
    - apps/admin/package.json
    - pnpm-lock.yaml

key-decisions:
  - "IMPORT_TABLE_ORDER mirrors TABLE_FILES from export route to guarantee consistent FK ordering"
  - "remap returns null on missing mapping (nullable FKs); remapRequired throws (non-nullable FKs) — fail fast pattern"
  - "IdMaps excludes junction tables (ReviewLike, Favorite, ReviewTag, UserBadge, ReviewPhoto, NotificationPreferences) — only tables with own id PK get maps"

patterns-established:
  - "Type contract file (types.ts) created before consumers to prevent circular dependencies"
  - "FK remap helpers co-located with IdMaps type for single-import convenience"

requirements-completed: [IMP-01, IMP-02, IMP-04, IMP-08]

# Metrics
duration: 8min
completed: 2026-04-06
---

# Phase 02 Plan 01: Import Types and Dependency Setup Summary

**unzipper dependency installed and shared import type contracts (ImportSummary, IdMaps, remap helpers) defined as foundation for the import pipeline**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-06T00:00:00Z
- **Completed:** 2026-04-06
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Installed `unzipper ^0.12.3` and `@types/unzipper ^0.10.11` in admin app — pairs with `archiver` used in export
- Created `apps/admin/app/api/import/types.ts` with all shared type contracts for the import pipeline
- Defined `IMPORT_TABLE_ORDER` (18 tables) matching TABLE_FILES from export route, ensuring consistent FK ordering
- Provided `createEmptyIdMaps`, `remap`, and `remapRequired` helpers that downstream plans (02 API route, 03 UI) can import directly

## Task Commits

Each task was committed atomically:

1. **Task 1: Install unzipper dependency** - `9f37c08` (chore)
2. **Task 2: Create import types and constants contract file** - `f3cad69` (feat)

## Files Created/Modified

- `apps/admin/app/api/import/types.ts` - All shared import types: CURRENT_SCHEMA_VERSION, IMPORT_TABLE_ORDER, ImportTableStats, ImportSummary, IdMaps, createEmptyIdMaps, remap, remapRequired
- `apps/admin/package.json` - Added unzipper and @types/unzipper
- `pnpm-lock.yaml` - Updated with unzipper lockfile entries

## Decisions Made

- IMPORT_TABLE_ORDER mirrors TABLE_FILES from export route exactly — this prevents FK constraint violations during import
- `remap` returns null on missing mapping (handles nullable FKs gracefully); `remapRequired` throws with context (fail fast for non-nullable FKs)
- Junction tables excluded from IdMaps — they have compound PKs and are inserted by referencing already-remapped foreign keys

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- pnpm was not on PATH; resolved by using `/usr/lib/node_modules/corepack/shims/pnpm` directly
- TypeScript compilation check showed pre-existing `@prisma/client` module resolution errors in admin (unrelated to this plan — prisma client not yet generated in this environment); types.ts itself compiled with no errors

## Known Stubs

None - this plan defines type contracts only (no data flow, no rendering).

## Next Phase Readiness

- Plan 02 (API route) can now `import { ImportSummary, IMPORT_TABLE_ORDER, createEmptyIdMaps, ... } from './types'`
- Plan 03 (UI) can `import type { ImportSummary } from '../import/types'` for the response shape
- No blockers for parallel execution of plans 02 and 03

---
*Phase: 02-import-pipeline-relational*
*Completed: 2026-04-06*
