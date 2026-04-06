---
phase: 03-photo-import-end-to-end
plan: "01"
subsystem: import-pipeline
tags: [import, photos, minio, docker, ui]
dependency_graph:
  requires: []
  provides: [photo-import-to-minio, import-photo-stats-ui, admin-docker-minio-env]
  affects: [apps/admin/app/api/import, apps/admin/app/dashboard/export, docker-compose.yml]
tech_stack:
  added: []
  patterns: [statObject-dedup, putObject-upload, sequential-photo-loop]
key_files:
  created: []
  modified:
    - apps/admin/app/api/import/types.ts
    - apps/admin/app/api/import/route.ts
    - apps/admin/app/dashboard/export/page.tsx
    - docker-compose.yml
decisions:
  - "Photo upload runs after DB transaction commits, not inside it — keeps transaction short"
  - "statObject used for dedup check before putObject — matches export pattern"
  - "Photo failures are pushed to errors array, not thrown — import is not aborted"
  - "Admin docker service gets explicit MINIO_* vars (not <<: *common-env) to preserve its own DATABASE_URL"
metrics:
  duration_seconds: 122
  completed_date: "2026-04-06"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 3 Plan 1: Photo Import Pipeline and UI Stats Summary

**One-liner:** Photo upload to MinIO after successful DB transaction using statObject dedup and putObject, with purple stat box in import UI.

## What Was Built

Completed the import pipeline so that photos from the export archive are uploaded to the target MinIO instance after the relational DB transaction commits. Extended the `ImportSummary` type with a `photos` field and updated the import UI to display a fourth colored stat box with photo upload counts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend import types, add photo upload to route, fix docker-compose | 69fcfc7 | types.ts, route.ts, docker-compose.yml |
| 2 | Add photo stats box to import UI summary | 5bddc73 | page.tsx |

## Key Changes

### types.ts
- Added `PhotoImportStats` interface with `uploaded`, `skipped`, `errors` fields
- Added optional `photos?: PhotoImportStats` field to `ImportSummary`

### route.ts
- Imported `minioClient` and `BUCKET` from `@/lib/minio`
- Imported `PhotoImportStats` from `./types`
- Added photo upload loop after `db.$transaction()` completes:
  - Filters ZIP entries with `path.startsWith('photos/')` and `type === 'File'`
  - Uses `statObject` to check if each file already exists (dedup)
  - Uses `putObject` to upload new files
  - Catches per-photo errors and appends to `photoStats.errors` (non-aborting)
  - Assigns `result.photos = photoStats` before returning response

### docker-compose.yml
- Added 6 MINIO_* environment variables to the `admin` service
- Added `minio: condition: service_healthy` to `admin` service `depends_on`

### page.tsx
- Changed summary grid from `grid-cols-3` to `grid-cols-2 sm:grid-cols-4`
- Added conditional purple stat box (`bg-purple-50`) showing `photos.uploaded`
- Added summary line showing skipped/error counts when photos present
- Added `Foto-fouten` error block for photo-specific errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All photo stats are wired from real MinIO upload results.

## Threat Flags

No new unplanned trust boundaries introduced. The photo upload path (`photos/` prefix stripping via fixed-length slice) matches the T-03-03 mitigation described in the plan's threat model.

## Self-Check: PASSED

- FOUND: apps/admin/app/api/import/types.ts
- FOUND: apps/admin/app/api/import/route.ts
- FOUND: apps/admin/app/dashboard/export/page.tsx
- FOUND: docker-compose.yml
- FOUND: commit 69fcfc7
- FOUND: commit 5bddc73
