# Phase 3: Photo Import + End-to-End - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 03-photo-import-end-to-end
**Areas discussed:** Photo upload approach, Error handling, Summary extension, Round-trip validation
**Mode:** Claude's discretion (user delegated all decisions)

---

## Photo Upload Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Inside DB transaction | Upload photos within the $transaction block | |
| After DB transaction | Upload photos after successful DB commit | ✓ |
| Separate endpoint | New /api/import-photos endpoint | |

**Claude's choice:** After DB transaction — MinIO uploads can't be rolled back with the DB, and photo records must exist first for storageKey mapping.

---

## Error Handling for Photos

| Option | Description | Selected |
|--------|-------------|----------|
| Abort on failure | Roll back everything if any photo fails | |
| Continue and report | Skip failed photos, report in summary | ✓ |
| Retry with backoff | Retry failed uploads 3 times before skipping | |

**Claude's choice:** Continue and report — partial photo availability is better than losing an entire successful relational import.

---

## Import Summary Extension

| Option | Description | Selected |
|--------|-------------|----------|
| Separate photos section | New field in ImportSummary for photo stats | ✓ |
| Per-table integration | Add photo counts to existing table stats | |

**Claude's choice:** Separate section — photos are binary assets, not table records.

---

## Round-trip Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Automated script | TypeScript script against Docker services | ✓ |
| Manual UI testing | Test via admin dashboard only | |
| Both | Script + manual testing | |

**Claude's choice:** Automated script — user explicitly requested Docker-based testing. Script is reusable and reliable.

---

## Claude's Discretion

- MinIO bucket verification, upload concurrency, validation runner, UI validate button

## Deferred Ideas

None
