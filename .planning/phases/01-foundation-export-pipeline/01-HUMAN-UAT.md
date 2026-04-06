---
status: partial
phase: 01-foundation-export-pipeline
source: [01-VERIFICATION.md]
started: "2026-04-06T12:55:00Z"
updated: "2026-04-06T12:55:00Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-End ZIP Download
expected: Click export button → spinner appears → button disables → ZIP downloads → button resets
result: [pending]

### 2. Manifest correctness
expected: manifest.json contains schemaVersion: 1, per-table counts, photosCount, photosSkipped
result: [pending]

### 3. Place lat/lng serialization
expected: data/places.json has "location": { "lat": ..., "lng": ... } objects, not nulls
result: [pending]

### 4. Review rating serialization
expected: data/reviews.json rating fields are numbers like 4.5, not empty objects {}
result: [pending]

### 5. Token table exclusion
expected: Exactly 18 files in data/, none named after token tables
result: [pending]

### 6. Unauthenticated rejection
expected: curl http://localhost:3001/api/export with no session cookie returns HTTP 401
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
