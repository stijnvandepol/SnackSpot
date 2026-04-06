---
status: partial
phase: 03-photo-import-end-to-end
source: [03-VERIFICATION.md]
started: 2026-04-06T18:00:00.000Z
updated: 2026-04-06T18:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Export → Import round-trip validation
expected: pnpm validate --snapshot passes — all 18 table counts match, photos accessible in MinIO, PostGIS lat/lng within tolerance
result: [pending]

### 2. Photo stats box in Import UI
expected: Fourth purple stat box "Foto's geupload" renders correctly after import with photo count
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
