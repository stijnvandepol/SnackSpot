---
phase: 03-photo-import-end-to-end
plan: "02"
subsystem: validation-tooling
tags: [validation, pg, minio, postgis, cli]
dependency_graph:
  requires: [03-01]
  provides: [round-trip-validation-script, pnpm-validate-command]
  affects: [scripts/validate-round-trip.ts, package.json]
tech_stack:
  added: [pg 8.13.0, "@types/pg 8.11.10"]
  patterns: [statObject-check, pg-direct-query, snapshot-compare]
key_files:
  created:
    - scripts/validate-round-trip.ts
  modified:
    - package.json
    - pnpm-lock.yaml
decisions:
  - "Direct pg Client used instead of Prisma — script runs outside Next.js, no ORM overhead needed"
  - "Snapshot includes both counts and coordinates — enables full round-trip comparison in one file"
  - "Missing photos mark passed=false but loop continues — full report of all missing keys"
  - "TABLE_NAMES is a hardcoded constant — eliminates SQL injection risk in table name interpolation"
metrics:
  duration_seconds: 240
  completed_date: "2026-04-06"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 3 Plan 2: Round-Trip Validation Script Summary

**One-liner:** CLI script using direct pg and minio clients to validate per-table record counts, photo accessibility via statObject, and PostGIS coordinate precision with 6 decimal place tolerance.

## What Was Built

Created `scripts/validate-round-trip.ts` — a standalone TypeScript CLI tool that verifies the complete export-import round-trip. The script connects directly to PostgreSQL (via `pg`) and MinIO (via `minio`) using environment variables, counts records in all 18 tables, checks every photo `storage_key` is accessible via `statObject`, spot-checks PostGIS coordinates using `ST_Y`/`ST_X`, and supports snapshot comparison mode for automated comparison between source and target instances.

Added `pg` and `@types/pg` as root workspace devDependencies, and registered the `pnpm validate` script entry in root `package.json`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install pg dependency and create validate script entry | 5f12863 | package.json, pnpm-lock.yaml |
| 2 | Create round-trip validation script | 534d25a | scripts/validate-round-trip.ts |

## Key Changes

### package.json
- Added `pg` and `@types/pg` to root `devDependencies`
- Added `"validate": "tsx scripts/validate-round-trip.ts"` to scripts section

### scripts/validate-round-trip.ts
- Reads `DATABASE_URL`, `MINIO_*` env vars; exits 1 with clear message if required vars missing
- `TABLE_NAMES` constant lists all 18 tables (snake_case matching PostgreSQL names)
- Table count loop: `SELECT COUNT(*)::int AS n FROM "${table}"` for all tables, prints each
- Photo check: queries `storage_key` from `photos`, calls `minio.statObject()` for each, tracks accessible/missing counts, lists missing keys (up to 20)
- PostGIS spot-check: `ST_Y(location::geometry)` / `ST_X(location::geometry)` on first 10 places, validates range (-90..90 / -180..180)
- `--snapshot <file>`: compares current counts against saved baseline, also compares coordinates with `TOLERANCE = 0.000001`
- `--save-snapshot <file>`: writes counts + coordinates + timestamp to JSON for future comparison
- Exits 0 if all checks pass, 1 on any mismatch or missing photo

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The script is a diagnostic CLI tool with no UI stubs.

## Threat Flags

No new unplanned trust boundaries introduced.

- T-03-05 mitigation confirmed: `TABLE_NAMES` is a hardcoded constant — no user input interpolated into SQL queries.

## Self-Check: PASSED

- FOUND: scripts/validate-round-trip.ts
- FOUND: package.json validate script entry
- FOUND: pg in devDependencies
- FOUND: commit 5f12863
- FOUND: commit 534d25a
