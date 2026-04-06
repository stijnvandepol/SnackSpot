---
phase: 02-import-pipeline-relational
verified: 2026-04-06T15:30:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "Import path in page.tsx corrected from '../api/import/types' to '../../api/import/types' — TS2307 resolved"
    - "Dedup checks added for reviews (findFirst by userId+placeId+createdAt), comments (findFirst by userId+reviewId+createdAt), notifications (findFirst by userId+type+createdAt), reports (findFirst by reporterId+targetType+createdAt), moderation-actions (findFirst by moderatorId+actionType+targetId+createdAt), blocked-words (findUnique by word), review-mentions (findUnique by reviewId_mentionedUserId composite), flagged-comments (findUnique by commentId)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "End-to-end import pipeline"
    expected: "Admin uploads export ZIP, import completes, per-table summary displays with correct imported/skipped/errors counts"
    why_human: "Cannot start admin app in CI environment; full round-trip requires running database and a valid ZIP from Phase 1 export"
  - test: "Re-run idempotency"
    expected: "Running the same archive twice produces zero new records in every table on the second run — all 18 tables show 0 imported and appropriate skipped counts"
    why_human: "Requires live database with pre-existing data and two sequential import operations; static analysis cannot simulate transaction-level dedup behavior"
---

# Phase 02: Import Pipeline (Relational) Verification Report

**Phase Goal:** Admins can upload an export archive and have all relational data merged into the target instance correctly — with a summary report
**Verified:** 2026-04-06T15:30:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (previous status: gaps_found, 3/5)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Admin uploads a ZIP via the dashboard file picker and sees a per-table summary (imported / skipped / errors) on completion | ✓ VERIFIED | page.tsx line 3: `import type { ImportSummary } from '../../api/import/types'` — correct path confirmed. File exists at `apps/admin/app/api/import/types.ts`. No TypeScript errors for import pipeline files. UI contains file picker (`type="file" accept=".zip"`), upload button with spinner (`animate-spin`), and full summary table rendering `importResult.tables`. |
| 2 | All 18 tables are written in dependency order — no FK constraint violations | ✓ VERIFIED | IMPORT_TABLE_ORDER in types.ts defines 18 filenames in FK dependency order (users → places → reviews → photos → review-photos → comments → badges → user-badges → review-likes → favorites → reports → moderation-actions → notifications → notification-preferences → review-mentions → review-tags → blocked-words → flagged-comments). route.ts iterates this constant for both pre-flight parse and transaction execution. |
| 3 | All foreign key IDs are remapped correctly including compound-key junction tables (ReviewLike, Favorite, etc.) | ✓ VERIFIED | `remapRequired()` used for all non-nullable FKs; `remap()` for nullable FKs. 12-entry IdMaps covers all tables with their own id PK. Compound-key junction tables (ReviewPhoto, UserBadge, ReviewLike, Favorite, NotificationPreferences, ReviewTag) use `createMany({ skipDuplicates: true })` with remapped FK fields. |
| 4 | Duplicate users (by email) and duplicate places (by name+address) are skipped, not overwritten | ✓ VERIFIED | Pre-flight dedup maps: `existingUsersByEmail` (lowercase email) and `existingPlacesByKey` (name::address). On match: idMaps updated with existing ID, tableStats.skipped incremented, loop continues. Also: badges (by slug), photos (by storageKey). |
| 5 | Re-running the same archive a second time produces zero new records in every table | ✓ VERIFIED | All content tables now have dedup: reviews (findFirst by userId+placeId+createdAt, line 212), comments (findFirst by userId+reviewId+createdAt, line 284), notifications (findFirst by userId+type+createdAt, line 432), reports (findFirst by reporterId+targetType+createdAt, line 373), moderation-actions (findFirst by moderatorId+actionType+targetId+createdAt, line 403), review-mentions (findUnique by reviewId_mentionedUserId composite, line 479), blocked-words (findUnique by word, line 514), flagged-comments (findUnique by commentId, line 539). Junction tables use createMany({ skipDuplicates: true }). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/admin/app/api/import/types.ts` | ImportSummary, ImportTableStats, IMPORT_TABLE_ORDER, CURRENT_SCHEMA_VERSION, IdMaps, createEmptyIdMaps, remap, remapRequired | ✓ VERIFIED | All 8 exports present. 103-line file, no stubs. Substantive, typed, and wired as import source for both route.ts and page.tsx. |
| `apps/admin/package.json` | unzipper dependency | ✓ VERIFIED | `"unzipper": "^0.12.3"` in dependencies, `"@types/unzipper": "^0.10.11"` in devDependencies. |
| `apps/admin/app/api/import/route.ts` | POST handler for ZIP import with full 18-table pipeline | ✓ VERIFIED | 596-line POST handler (expanded from 509 with dedup additions). Auth guard, ZIP parse, manifest validation, 18 JSON file pre-flight parse, 4 pre-flight dedup maps, single Prisma transaction with all 18 table importers — each with appropriate dedup logic. |
| `apps/admin/app/dashboard/export/page.tsx` | Import UI with file picker, upload button, spinner, summary report | ✓ VERIFIED | File picker (`type="file" accept=".zip"`), handleImport with FormData POST to `/api/import`, spinner (`animate-spin`), importResult summary table, per-table error detail section. ImportSummary import path corrected to `'../../api/import/types'`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/admin/app/api/import/route.ts` | `apps/admin/app/api/import/types.ts` | `import { ImportSummary, ... } from './types'` | ✓ WIRED | Lines 5–14: all 8 exports imported (ImportSummary, ImportTableStats, IdMaps, CURRENT_SCHEMA_VERSION, IMPORT_TABLE_ORDER, createEmptyIdMaps, remap, remapRequired). |
| `apps/admin/app/api/import/route.ts` | `apps/admin/lib/auth.ts` | `requireAdmin(req)` | ✓ WIRED | Line 49: `const auth = requireAdmin(req)` with `if (auth instanceof Response) return auth` guard. |
| `apps/admin/app/api/import/route.ts` | `apps/admin/lib/db.ts` | `db.$transaction` | ✓ WIRED | Line 149: `await db.$transaction(async (tx) => { ... }, { timeout: 60000, maxWait: 10000 })`. |
| `apps/admin/app/dashboard/export/page.tsx` | `/api/import` | `fetch('/api/import', { method: 'POST', body: formData })` | ✓ WIRED | Lines 60–63: FormData built with `formData.append('file', selectedFile)`, POST to `/api/import`. |
| `apps/admin/app/dashboard/export/page.tsx` | `apps/admin/app/api/import/types.ts` | `import type { ImportSummary } from '../../api/import/types'` | ✓ WIRED | Line 3: path `'../../api/import/types'` correctly resolves from `app/dashboard/export/page.tsx` to `app/api/import/types.ts`. No TypeScript errors for import pipeline files. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `apps/admin/app/dashboard/export/page.tsx` | `importResult` (ImportSummary) | `fetch('/api/import')` response | Yes — route.ts returns full ImportSummary built from real DB inserts inside `db.$transaction` | ✓ FLOWING |
| `apps/admin/app/api/import/route.ts` | `tableStats`, `idMaps` | ZIP parsing + Prisma creates inside transaction | Yes — real DB writes, counts accumulated in tableStats, idMaps populated per table | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running admin app with live database and a valid export ZIP archive. Cannot test without live services.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| IMP-01 | 02-01, 02-02, 02-03 | Admin can upload a ZIP file via file picker in the dashboard | ✓ SATISFIED | page.tsx: file picker (`type="file" accept=".zip"`), import path corrected, fetchPost to `/api/import` wired. |
| IMP-02 | 02-01, 02-02 | Import validates all data before writing (schema + referential integrity) | ✓ SATISFIED | route.ts: manifest presence check, schemaVersion equality, all 18 JSON files parsed and array-validated before any DB write (lines 74–108). |
| IMP-03 | 02-02 | Tables imported in FK dependency order | ✓ SATISFIED | IMPORT_TABLE_ORDER constant (18 tables in FK order) iterated for both pre-flight parse and transaction execution. |
| IMP-04 | 02-01, 02-02 | ID remapping — new IDs generated, foreign keys rewritten across all tables | ✓ SATISFIED | createEmptyIdMaps() initializes 12 IdMaps; remapRequired/remap used throughout all 18 table importers. |
| IMP-05 | 02-02 | Duplicate detection via unique fields (email for users, name+address for places) | ✓ SATISFIED | existingUsersByEmail (case-insensitive email) and existingPlacesByKey (name::address) built before transaction. Also: badges by slug, photos by storageKey, and content tables by stable composite key. |
| IMP-06 | 02-02 | Existing records preserved on duplicate (skip, not overwrite) | ✓ SATISFIED | All dedup branches: idMaps.X.set(r.id, existingId); tableStats.skipped++; continue — no overwrite occurs. |
| IMP-08 | 02-01, 02-02, 02-03 | Import shows a summary report (per table: imported, skipped, errors) | ✓ SATISFIED | API route builds full ImportSummary with per-table stats. UI renders summary table with Geimporteerd/Overgeslagen/Fouten columns, plus colored aggregate stat boxes. |
| IMP-09 | 02-02 | On hard errors, import aborts without partial writes | ✓ SATISFIED | All 18 table importers inside single `db.$transaction({ timeout: 60000 })`. Any thrown error rolls back entire transaction. Outer catch returns `success: false` ImportSummary with error message. |

**IMP-07** (Photo import) is assigned to Phase 3 per REQUIREMENTS.md traceability — not in scope for Phase 2. No gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/admin/app/api/import/route.ts` | 149 | `async (tx: Parameters<...>[0])` — explicit but verbose type annotation for tx parameter | Info | Type annotation is present (not implicit any). Verbose but correct. No runtime impact. |

No blockers found. Previous blocker (broken import path) and previous warning (blocked-words without dedup) are both resolved.

### Human Verification Required

#### 1. End-to-End Import Pipeline

**Test:** Start the admin app (`pnpm --filter @snackspot/admin dev`), navigate to Export / Import in the dashboard sidebar. Click "Download Export" to generate a ZIP. Then use the file picker to select that ZIP and click "Start Import".
**Expected:** Spinner appears during upload. On completion, a summary report shows three colored stat boxes (Geimporteerd, Overgeslagen, Tabellen) and a table listing all 18 tables with their import counts. Users and places from the same instance appear as Overgeslagen.
**Why human:** Requires running Next.js admin app, PostgreSQL with PostGIS, and a valid Phase 1 export archive. Cannot verify in static analysis.

#### 2. Re-Run Idempotency

**Test:** After a successful import, upload the same ZIP archive a second time.
**Expected:** Zero records imported across all 18 tables. All content tables (reviews, comments, notifications, reports, moderation-actions, blocked-words, review-mentions, flagged-comments) show skipped > 0, imported = 0. No transaction abort from unique constraint violations.
**Why human:** Requires live database with data already present from first import run and two sequential import operations; static analysis cannot simulate transaction-level dedup behavior at runtime.

### Re-Verification Summary

Both gaps from the initial verification (2026-04-06) are confirmed closed:

**Gap 1 — Import path fix (CLOSED):** `apps/admin/app/dashboard/export/page.tsx` line 3 now reads `import type { ImportSummary } from '../../api/import/types'`. The path correctly resolves from `app/dashboard/export/` two levels up to `app/`, then into `api/import/types.ts`. No TypeScript errors found for import pipeline files.

**Gap 2 — Re-run idempotency (CLOSED):** All 8 previously missing dedup checks are now present in `route.ts`: reviews (findFirst, line 212), comments (findFirst, line 284), notifications (findFirst, line 432), reports (findFirst, line 373), moderation-actions (findFirst, line 403), review-mentions (findUnique composite, line 479), blocked-words (findUnique by word, line 514), flagged-comments (findUnique by commentId, line 539). The critical blocked-words unique constraint violation path is eliminated.

No regressions detected in previously passing truths (truths 2, 3, 4 from initial verification).

---

_Verified: 2026-04-06T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
