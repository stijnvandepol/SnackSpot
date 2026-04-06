# Roadmap: SnackSpot Admin Export/Import

## Overview

Three phases deliver a complete ZIP-based export/import system for the SnackSpot admin panel. Phase 1 proves the manifest format and streaming architecture by building a working export. Phase 2 tackles the hardest correctness problems — FK ordering, ID remapping, duplicate detection — by building the full relational import pipeline. Phase 3 adds photo import and validates the complete round-trip end-to-end.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation + Export Pipeline** - Types, MinIO client, and full streaming export — proves the manifest format
- [ ] **Phase 2: Import Pipeline (Relational)** - Import all 18 tables with FK ordering, ID remapping, duplicate detection, and summary report (no photos)
- [ ] **Phase 3: Photo Import + End-to-End** - Photo upload from archive to MinIO, full round-trip validation

## Phase Details

### Phase 1: Foundation + Export Pipeline
**Goal**: Admins can download a complete ZIP archive of all database records and photos from the dashboard
**Depends on**: Nothing (first phase)
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04, EXP-05, EXP-06, EXP-07, EXP-08, INF-01, INF-02, INF-03
**Success Criteria** (what must be TRUE):
  1. Admin clicks "Export" in the dashboard and a ZIP file downloads without the page locking up
  2. The downloaded ZIP contains one JSON file per table with all records, including correct lat/lng values for Place locations
  3. The downloaded ZIP contains all photo binaries from MinIO
  4. Token tables (RefreshToken, PasswordResetToken, EmailVerificationToken) are absent from the archive
  5. The archive includes a manifest with schema version; the pipeline stays streaming (flat RAM under load)
**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md — Install archiver/minio dependencies, extend admin env schema, create MinIO client
- [x] 01-02-PLAN.md — Streaming export API route (18 tables + photos + manifest)
- [x] 01-03-PLAN.md — Export UI page with sidebar nav and download button
**UI hint**: yes

### Phase 2: Import Pipeline (Relational)
**Goal**: Admins can upload an export archive and have all relational data merged into the target instance correctly — with a summary report
**Depends on**: Phase 1
**Requirements**: IMP-01, IMP-02, IMP-03, IMP-04, IMP-05, IMP-06, IMP-08, IMP-09
**Success Criteria** (what must be TRUE):
  1. Admin uploads a ZIP via the dashboard file picker and sees a per-table summary (imported / skipped / errors) on completion
  2. All 18 tables are written in dependency order — no FK constraint violations
  3. All foreign key IDs are remapped correctly including compound-key junction tables (ReviewLike, Favorite, etc.)
  4. Duplicate users (by email) and duplicate places (by name+address) are skipped, not overwritten
  5. Re-running the same archive a second time produces zero new records in every table
**Plans**: TBD
**UI hint**: yes

### Phase 3: Photo Import + End-to-End
**Goal**: Import is complete — photos from the archive are uploaded to target MinIO, and the full export → import round-trip is verified
**Depends on**: Phase 2
**Requirements**: IMP-07
**Success Criteria** (what must be TRUE):
  1. After import, every photo referenced in the database is retrievable from the target MinIO instance
  2. A full round-trip (export populated instance → import to empty instance) produces matching record counts, correct place lat/lng values, and accessible photos
  3. The import summary report includes per-entity photo counts (uploaded / skipped / errors)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Export Pipeline | 0/3 | Planned | - |
| 2. Import Pipeline (Relational) | 0/? | Not started | - |
| 3. Photo Import + End-to-End | 0/? | Not started | - |
