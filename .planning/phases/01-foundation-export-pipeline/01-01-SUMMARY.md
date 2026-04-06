---
phase: 01-foundation-export-pipeline
plan: "01"
subsystem: admin-infra
tags: [minio, archiver, env, dependencies]
dependency_graph:
  requires: []
  provides: [admin-minio-client, admin-archiver-dep]
  affects: [01-02-export-route]
tech_stack:
  added: [archiver@7.0.1, minio@8.0.3, "@types/archiver@7.0.0"]
  patterns: [env-validation-zod, minio-client-factory]
key_files:
  created:
    - apps/admin/lib/minio.ts
  modified:
    - apps/admin/package.json
    - apps/admin/lib/env.ts
    - pnpm-lock.yaml
decisions:
  - "Admin MinIO client omits ensureBucket/presignedPut/publicMinioClient — admin reads from existing bucket only"
  - "MINIO_USE_SSL uses string transform (v === 'true') matching web app env pattern"
metrics:
  duration_minutes: 5
  completed_date: "2026-04-06T10:35:15Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 3
---

# Phase 01 Plan 01: Admin MinIO Infrastructure Summary

**One-liner:** MinIO client + archiver dependency installed in admin app with Zod-validated MINIO_* env schema.

## What Was Built

Installed `archiver` (v7.0.1) and `minio` (v8.0.3) as production dependencies in the admin app, plus `@types/archiver` as a dev dependency. Extended `apps/admin/lib/env.ts` with 6 new MINIO_* env var validations. Created `apps/admin/lib/minio.ts` as a simplified MinIO client module exporting `minioClient` and `BUCKET`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install archiver + minio dependencies and extend admin env schema | 346d808 | apps/admin/package.json, apps/admin/lib/env.ts, pnpm-lock.yaml |
| 2 | Create admin MinIO client module | 9cc8641 | apps/admin/lib/minio.ts |

## Decisions Made

1. **Simplified admin MinIO client** — The admin client omits `ensureBucket`, `presignedPut`, and `publicMinioClient` because the admin export route only reads from an existing bucket (does not create buckets or generate presigned URLs for browser uploads).

2. **MINIO_USE_SSL string transform** — Matches the web app's existing env pattern: `z.string().transform(v => v === 'true').default('false')`, converting the environment string to boolean.

## Deviations from Plan

None — plan executed exactly as written.

Pre-existing TypeScript errors for `@prisma/client` were observed during `tsc --noEmit` but are unrelated to this plan (require `pnpm db:generate` to resolve). Neither `minio.ts` nor `env.ts` introduced any new type errors.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The `MINIO_SECRET_KEY` env var is loaded server-side only, validated via Zod at startup, and never logged or serialized. Consistent with T-01-01 and T-01-02 from the plan's threat register.

## Known Stubs

None.

## Self-Check: PASSED

- [x] apps/admin/lib/minio.ts exists
- [x] apps/admin/package.json contains archiver, minio, @types/archiver
- [x] apps/admin/lib/env.ts contains all 6 MINIO_* var definitions
- [x] Commits 346d808 and 9cc8641 exist
