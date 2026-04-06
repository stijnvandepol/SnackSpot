---
phase: 02-import-pipeline-relational
plan: 03
subsystem: admin-ui
tags: [import, ui, react, file-picker, dutch, summary-report]

# Dependency graph
requires:
  - phase: 02-import-pipeline-relational
    plan: 01
    provides: ImportSummary type contract consumed by import UI
  - phase: 02-import-pipeline-relational
    plan: 02
    provides: POST /api/import handler that this UI calls
provides:
  - Import UI section on Export/Import page (file picker, upload button with spinner, inline summary report)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - FormData upload via fetch to /api/import
    - Controlled file input with useState<File | null>
    - Spinner pattern with animate-spin Tailwind class
    - Per-table summary table rendered from ImportSummary.tables Record

key-files:
  created: []
  modified:
    - apps/admin/app/dashboard/export/page.tsx

key-decisions:
  - "Import section placed below export card so existing export flow is unaffected"
  - "File input reset via document.querySelector after successful import to clear picker state"
  - "Both importError and importResult can coexist so partial-failure summaries are shown even when overall success=false"

# Metrics
duration: 5min
completed: 2026-04-06
---

# Phase 02 Plan 03: Import UI Summary

**Import section added to Export/Import page: file picker (.zip only), upload button with spinner, inline per-table summary report — all copy in Dutch, human verification passed**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-06T13:30:00Z
- **Completed:** 2026-04-06
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Extended `apps/admin/app/dashboard/export/page.tsx` with a complete import card rendered below the existing export card
- Added four new state variables: `importLoading`, `importError`, `importResult` (typed as `ImportSummary | null`), `selectedFile`
- `handleImport` builds a `FormData`, POSTs to `/api/import`, and handles both success and partial-failure responses
- File picker accepts only `.zip` files; upload button is disabled until a file is selected
- Spinner (`animate-spin`) shown on upload button during import; button label changes to "Importeren..."
- Summary report shows three colored stat boxes (Geimporteerd / Overgeslagen / Tabellen) and a per-table breakdown table
- Per-table error section rendered conditionally when any `stats.errors.length > 0`
- All UI copy in Dutch per D-03 constraint
- Human verification checkpoint passed — user approved the import pipeline end-to-end

## Task Commits

1. **Task 1: Add import section with file picker, upload, spinner, and summary report** — `d9df641` (feat)
2. **Task 2: Verify import pipeline end-to-end** — human-verify checkpoint, approved by user (no code changes)

## Files Created/Modified

- `apps/admin/app/dashboard/export/page.tsx` — added `import type { ImportSummary }` from types.ts, four state variables, `handleImport` async function, and import card JSX with file picker, upload button, spinner, summary stats grid, per-table breakdown table, and per-table error section

## Decisions Made

- Import section placed below export card: preserves existing export UI without modification
- File reset via `document.querySelector<HTMLInputElement>` after successful import: clears picker state so admin can immediately run another import
- `importError` and `importResult` can both be set simultaneously: allows partial-failure summaries (success=false but tables partial data) to be displayed alongside the error message

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - the import UI is fully wired to the `/api/import` endpoint with real response rendering.

## Threat Flags

None - no new network endpoints or auth paths introduced. The fetch call sends auth cookies automatically (same-origin), and `/api/import` enforces `requireAdmin()` per plan 02.

Threats mitigated per plan:
- T-02-08: Auth cookie sent automatically with same-origin fetch; `requireAdmin()` enforced server-side
- T-02-09: Summary report error messages only visible to authenticated admin

## Self-Check: PASSED

- `apps/admin/app/dashboard/export/page.tsx` exists and contains all required import UI elements
- Commit `d9df641` exists in git history
- Human verification checkpoint approved by user

---
*Phase: 02-import-pipeline-relational*
*Completed: 2026-04-06*
