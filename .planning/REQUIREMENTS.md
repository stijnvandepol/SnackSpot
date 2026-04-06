# Requirements: SnackSpot Admin Export/Import

**Defined:** 2026-04-06
**Core Value:** A complete, validated data transfer between instances — every record, every relationship, every photo — without data loss or corruption.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Export

- [ ] **EXP-01**: Admin can export all data + photos as a ZIP download via a dashboard button
- [ ] **EXP-02**: Export contains JSON files per table with all records and relationships
- [ ] **EXP-03**: PostGIS geography data is serialized as GeoJSON (lat/lng)
- [ ] **EXP-04**: Decimal ratings are correctly serialized (not as empty objects)
- [ ] **EXP-05**: Photos are streamed from MinIO and included in the ZIP archive
- [ ] **EXP-06**: ZIP is generated via streaming (no full in-memory buffering)
- [ ] **EXP-07**: Token tables (refresh, password reset, email verification) are excluded from export
- [ ] **EXP-08**: Export includes a manifest with schema version and metadata

### Import

- [ ] **IMP-01**: Admin can upload a ZIP file via file picker in the dashboard
- [ ] **IMP-02**: Import validates all data before writing (schema + referential integrity)
- [ ] **IMP-03**: Tables are imported in FK dependency order (users/places before reviews)
- [ ] **IMP-04**: ID remapping — new IDs generated, foreign keys rewritten across all tables
- [ ] **IMP-05**: Duplicate detection via unique fields (email for users, name+address for places)
- [ ] **IMP-06**: Existing records are preserved on duplicate (skip, not overwrite)
- [ ] **IMP-07**: Photos from the archive are uploaded to the target MinIO instance
- [ ] **IMP-08**: Import shows a summary report (per table: imported, skipped, errors)
- [ ] **IMP-09**: On hard errors, import aborts without partial writes

### Infrastructure

- [ ] **INF-01**: All endpoints behind existing `requireAdmin()` auth middleware
- [ ] **INF-02**: Admin app gets its own MinIO client (reuses existing config)
- [ ] **INF-03**: Schema version in export manifest — mismatch rejected on import

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Automation

- **AUTO-01**: Scheduled automatic exports via cron/API
- **AUTO-02**: Export retention policy (keep last N exports)

### Filtering

- **FILT-01**: Export subset of data (specific tables or date ranges)
- **FILT-02**: Overwrite-on-duplicate import strategy (upsert)

### UX

- **UX-01**: Real-time progress streaming via SSE/WebSocket
- **UX-02**: Cross-version schema migration support

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Incremental/differential exports | Requires change tracking and merge logic — massive complexity for marginal benefit |
| Export filtering (subset of data) | Partial exports contain dangling FK references — referential integrity requires complete export |
| Cross-version schema migration | Unbounded maintenance surface; import expects same schema version |
| Real-time progress streaming | Simple progress indication + summary report is sufficient; SSE/WebSocket is overengineering |
| Inline error editing during import | Data has complex 15+ table relationships — not a flat spreadsheet; fix source and re-export |
| Overwrite-on-duplicate (upsert) | Creates ambiguous partial state and silent data destruction; skip is safer and auditable |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXP-01 | Phase 1 | Pending |
| EXP-02 | Phase 1 | Pending |
| EXP-03 | Phase 1 | Pending |
| EXP-04 | Phase 1 | Pending |
| EXP-05 | Phase 1 | Pending |
| EXP-06 | Phase 1 | Pending |
| EXP-07 | Phase 1 | Pending |
| EXP-08 | Phase 1 | Pending |
| IMP-01 | Phase 2 | Pending |
| IMP-02 | Phase 2 | Pending |
| IMP-03 | Phase 2 | Pending |
| IMP-04 | Phase 2 | Pending |
| IMP-05 | Phase 2 | Pending |
| IMP-06 | Phase 2 | Pending |
| IMP-07 | Phase 3 | Pending |
| IMP-08 | Phase 2 | Pending |
| IMP-09 | Phase 2 | Pending |
| INF-01 | Phase 1 | Pending |
| INF-02 | Phase 1 | Pending |
| INF-03 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after roadmap creation*
