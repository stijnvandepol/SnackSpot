---
status: partial
phase: 02-import-pipeline-relational
source: [02-VERIFICATION.md]
started: 2026-04-06T14:00:00.000Z
updated: 2026-04-06T14:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end import pipeline
expected: Admin can export ZIP, upload via import file picker, see per-table summary report with Dutch labels (Geimporteerd/Overgeslagen/Tabellen)
result: [pending]

### 2. Re-run idempotency
expected: Uploading the same ZIP a second time produces zero new records in every table, no transaction errors
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
