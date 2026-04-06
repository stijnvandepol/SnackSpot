---
phase: 03-photo-import-end-to-end
verified: 2026-04-06T14:07:11Z
status: human_needed
score: 11/11 must-haves verified
human_verification:
  - test: "Run a real export → import round-trip: export a populated instance, import to an empty instance, then run `pnpm validate --snapshot <source-snapshot.json>`"
    expected: "All 18 table counts match, all photo storageKeys accessible in MinIO, PostGIS coordinates within 0.000001 tolerance — RESULT: ALL CHECKS PASSED"
    why_human: "Requires running Docker services (PostgreSQL with PostGIS, MinIO) and uploading a real ZIP archive through the admin UI — cannot be verified with static file inspection"
  - test: "Upload a ZIP archive via the admin Import UI and observe the summary page"
    expected: "Four stat boxes appear (green Geimporteerd, yellow Overgeslagen, blue Tabellen, purple Foto's geupload). The purple box shows the count of photos uploaded. If any photo upload errors occurred, a Foto-fouten error block appears."
    why_human: "Visual rendering of React UI components requires a browser; conditional rendering of the purple box depends on importResult.photos being truthy (only set after a real import run)"
---

# Phase 3: Photo Import + End-to-End Verification Report

**Phase Goal:** Import is complete — photos from the archive are uploaded to target MinIO, and the full export → import round-trip is verified
**Verified:** 2026-04-06T14:07:11Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Photos from the export archive are uploaded to target MinIO after successful relational import | ✓ VERIFIED | `route.ts` lines 585–627: photo upload loop runs after `db.$transaction()` completes; calls `minioClient.putObject` |
| 2 | Photos that already exist in MinIO are skipped (dedup by storageKey) | ✓ VERIFIED | `route.ts` lines 606–614: `minioClient.statObject` called before upload; skips on `alreadyExists=true` |
| 3 | Photo upload failures are reported in the summary, not abort the import | ✓ VERIFIED | `route.ts` lines 619–624: `catch(err)` pushes to `photoStats.errors`, does not throw |
| 4 | Import summary response includes photos section with uploaded/skipped/errors counts | ✓ VERIFIED | `route.ts` line 627: `result.photos = photoStats`; `types.ts` lines 39–43: `PhotoImportStats` interface; `types.ts` line 55: `photos?: PhotoImportStats` on `ImportSummary` |
| 5 | UI shows a fourth stat box with photo upload counts | ✓ VERIFIED | `page.tsx` lines 185–190: conditional `bg-purple-50` box rendering `importResult.photos.uploaded`; grid changed to `grid-cols-2 sm:grid-cols-4` |
| 6 | Admin Docker container has MINIO environment variables | ✓ VERIFIED | `docker-compose.yml` lines 198–203: 6 MINIO_* vars in admin service; lines 209–210: `minio: condition: service_healthy` in depends_on |
| 7 | Running the validation script against a populated instance reports per-table record counts | ✓ VERIFIED | `validate-round-trip.ts` lines 72–79: iterates `TABLE_NAMES` (18 tables), queries `COUNT(*)::int`, prints each count |
| 8 | Script checks every photo storageKey in the database is accessible in MinIO | ✓ VERIFIED | `validate-round-trip.ts` lines 131–161: queries `storage_key FROM photos`, calls `minio.statObject()` for each; tracks accessible/missing |
| 9 | Script compares PostGIS lat/lng values with 6 decimal place tolerance | ✓ VERIFIED | `validate-round-trip.ts` lines 96–112: `TOLERANCE = 0.000001`; compares using `ST_Y(location::geometry)` / `ST_X(location::geometry)` when `--snapshot` provided |
| 10 | Script exits 0 on full match, 1 on any mismatch | ✓ VERIFIED | `validate-round-trip.ts` line 194: `process.exit(passed ? 0 : 1)`; `passed` set to `false` on any missing photo or count mismatch |
| 11 | Script can be run with `pnpm validate` | ✓ VERIFIED | `package.json` line 14: `"validate": "tsx scripts/validate-round-trip.ts"` |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/admin/app/api/import/types.ts` | PhotoImportStats interface and photos field on ImportSummary | ✓ VERIFIED | `PhotoImportStats` at lines 39–43; `photos?: PhotoImportStats` at line 55 of `ImportSummary` |
| `apps/admin/app/api/import/route.ts` | Photo upload loop after transaction | ✓ VERIFIED | Photo upload block at lines 585–627; `putObject` at line 617 |
| `apps/admin/app/dashboard/export/page.tsx` | Fourth stat box for photo counts | ✓ VERIFIED | `importResult.photos.uploaded` rendered in `bg-purple-50` box at lines 185–190 |
| `docker-compose.yml` | Admin service with MINIO env vars | ✓ VERIFIED | 6 MINIO_* vars at lines 198–203; minio dependency at lines 209–210 |
| `scripts/validate-round-trip.ts` | Round-trip validation script | ✓ VERIFIED | File exists with shebang, all 18 tables, statObject check, TOLERANCE, process.exit |
| `package.json` | validate script entry and pg devDependency | ✓ VERIFIED | `"validate": "tsx scripts/validate-round-trip.ts"` at line 14; `pg` and `@types/pg` in devDependencies |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/admin/app/api/import/route.ts` | `apps/admin/lib/minio.ts` | `minioClient.putObject` and `statObject` | ✓ WIRED | Import at line 5: `import { minioClient, BUCKET } from '@/lib/minio'`; `putObject` at line 617, `statObject` at line 607 |
| `apps/admin/app/api/import/route.ts` | `apps/admin/app/api/import/types.ts` | PhotoImportStats type import | ✓ WIRED | `PhotoImportStats` imported at line 10; used at line 588 |
| `apps/admin/app/dashboard/export/page.tsx` | `apps/admin/app/api/import/types.ts` | ImportSummary.photos field | ✓ WIRED | `ImportSummary` imported at line 3; `importResult.photos` accessed at lines 185, 193, 245 |
| `scripts/validate-round-trip.ts` | PostgreSQL database | pg Client with DATABASE_URL | ✓ WIRED | `new Client({ connectionString: DATABASE_URL })` at line 59 |
| `scripts/validate-round-trip.ts` | MinIO storage | minio.Client with MINIO_* env vars | ✓ WIRED | `new Minio.Client(...)` at lines 60–66 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `route.ts` photo upload | `photoStats` | MinIO `statObject`/`putObject` calls in upload loop (lines 606–618) | Yes — counts populated from real MinIO API responses | ✓ FLOWING |
| `page.tsx` photo stat box | `importResult.photos` | API response from `/api/import` POST, assigned at line 75: `setImportResult(data)` | Yes — sourced from real import API response | ✓ FLOWING |
| `validate-round-trip.ts` | `counts`, `accessible`, `missing` | Direct `pg.query` + `minio.statObject` calls | Yes — queries live database and MinIO | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| validate script has correct shebang | `head -1 scripts/validate-round-trip.ts` | `#!/usr/bin/env tsx` | ✓ PASS |
| package.json validate script present | `node -e "require('./package.json').scripts.validate"` | `tsx scripts/validate-round-trip.ts` | ✓ PASS |
| pg devDependency present | `node -e "require('./package.json').devDependencies.pg"` | `^8.13.0` | ✓ PASS |
| All 18 tables in validation script | Pattern check for each table name | All 18 present | ✓ PASS |
| PhotoImportStats in types.ts | `grep "PhotoImportStats" apps/admin/app/api/import/types.ts` | Found at lines 39, 55 | ✓ PASS |
| putObject/statObject in route.ts | Count of 4 key patterns | 8 matches | ✓ PASS |
| MINIO vars in admin docker service | `grep "MINIO_ENDPOINT\|MINIO_BUCKET" docker-compose.yml` | Lines 4, 9, 128, 198, 203 — admin block has both | ✓ PASS |
| TS compilation — phase files only | `npx tsc --noEmit -p apps/admin/tsconfig.json 2>&1 \| grep "import/route\|import/types\|export/page\|minio"` | No errors in phase files | ✓ PASS |

Note: TypeScript compilation produces errors for unrelated files (`@prisma/client` module not found — Prisma client not generated in this environment). The phase's own files produce no type errors.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| IMP-07 | 03-01-PLAN.md, 03-02-PLAN.md | Photos from the archive are uploaded to the target MinIO instance | ✓ SATISFIED | Photo upload loop in `route.ts` lines 585–627; `statObject` dedup; `putObject` upload; `photoStats` accumulated and returned in response |

**Orphaned requirements check:** REQUIREMENTS.md maps only IMP-07 to Phase 3 (line 91). Both plans declare `requirements: [IMP-07]`. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME/placeholder comments or empty implementations found in phase files. Photo stats are wired from real MinIO upload results. The `photoStats.errors` array starts empty and is populated only by real caught exceptions — it is not a stub return.

### Human Verification Required

#### 1. Export → Import Round-Trip with Validation Script

**Test:** On a running stack (Docker Compose up):
1. Save a snapshot from the source instance: `DATABASE_URL=... MINIO_* pnpm validate --save-snapshot /tmp/source.json`
2. Export the ZIP via the admin dashboard
3. Import the ZIP into an empty target instance via the admin dashboard
4. Run: `DATABASE_URL=<target> MINIO_* pnpm validate --snapshot /tmp/source.json`

**Expected:** All 18 table counts match source snapshot; all photo storageKeys accessible in target MinIO; PostGIS coordinates within 0.000001 tolerance — script prints `RESULT: ALL CHECKS PASSED` and exits 0.

**Why human:** Requires live Docker services (PostgreSQL with PostGIS, MinIO), a populated source database, and a ZIP archive produced by the export feature. Cannot be verified with static file inspection alone.

#### 2. Photo Stats Box in Import UI

**Test:** Upload a non-trivial export ZIP via the admin Import UI (`/dashboard/export`).

**Expected:** After successful import, the summary grid shows four stat boxes. The fourth box has purple styling (`bg-purple-50`) and displays the count of photos uploaded with the label "Foto's geupload". If photos were skipped, the summary line below the grid shows "X geupload, Y overgeslagen". If any photos failed, a "Foto-fouten" error block appears below the table.

**Why human:** Conditional rendering of the `importResult.photos` block depends on the API returning a non-null `photos` field, which only occurs after a real import run. Visual correctness and correct count display require browser testing.

### Gaps Summary

No gaps found. All 11 observable truths are verified. All 6 required artifacts exist, are substantive, and are wired with real data flowing. The only remaining items require live service testing that cannot be performed programmatically.

---

_Verified: 2026-04-06T14:07:11Z_
_Verifier: Claude (gsd-verifier)_
