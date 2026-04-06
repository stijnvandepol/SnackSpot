# Feature Research

**Domain:** Data export/import system for web admin panel
**Researched:** 2026-04-06
**Confidence:** HIGH (core patterns), MEDIUM (UX specifics)

## Feature Landscape

### Table Stakes (Users Expect These)

Features admins assume exist. Missing these = the feature feels broken or unsafe.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Full data export as single file | Admins need one artifact they can store or hand off — not multiple files to assemble | MEDIUM | ZIP containing JSON data + binary photos is the right unit |
| Relationship preservation in export | Export with orphaned foreign keys is useless — referential integrity must survive the round-trip | HIGH | Requires exporting in correct order AND encoding relationships explicitly in JSON |
| Import validation before any writes | Writing bad data silently is worse than failing — admins must know what will happen before it happens | HIGH | Validate schema, referential integrity, and uniqueness before opening a transaction |
| Duplicate detection on import | Reimporting to the same instance is the common "disaster recovery test" scenario — no way to prevent duplicates without this | MEDIUM | Unique field matching (email for users, name+address for places) is more meaningful than UUID matching across instances |
| Import summary report | Without counts of imported/skipped/errored records the admin cannot confirm the operation succeeded | LOW | Report must show: created, skipped (duplicate), errors with reason |
| Auth-protected endpoints | Export contains all user PII and content — must be behind admin-only auth | LOW | Existing `requireAdmin()` middleware handles this; no new auth logic needed |
| File-based upload/download UI | Admins expect a button to download and a file picker to upload — no CLI, no SSH | LOW | First file upload/download in admin app; needs multipart form handling |
| Error surfacing (not silent failure) | An import that silently half-succeeded is the worst possible outcome | MEDIUM | Errors per record type should be surfaced in the summary; hard errors should abort with no partial write |

### Differentiators (Competitive Advantage)

Features that go beyond the baseline. These align with SnackSpot's core value of complete, validated data transfer.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| ID remapping on import | Allows importing into an instance that already has data — UUIDs from source instance become new UUIDs in target, relationships follow | HIGH | Without this, importing into a non-empty DB causes PK collisions. Must remap IDs across all tables in dependency order. Critical differentiator vs naive dump-restore |
| Skip-on-duplicate strategy (no overwrite) | Preserves existing data — correct for both backup restore and migration use cases; safer than upsert | LOW | Explicit, predictable, auditable behavior. Contrast with upsert/merge which creates ambiguous partial states |
| PostGIS geography serialization | Location data (lat/lng) is stored as PostGIS geography — naively dumping the binary type produces unreadable/unimportable data | MEDIUM | Use GeoJSON (ST_AsGeoJSON / ST_GeomFromGeoJSON) as the interchange format. WGS84/EPSG:4326 as standard CRS |
| Streaming ZIP generation | Large instances with many photos could produce multi-GB archives — loading into memory before writing would crash the server | HIGH | Use Node.js streams with `archiver` library; pipe directly to HTTP response. Avoids OOM on large exports |
| Photo binary inclusion in export | Purely a JSON dump of the DB is insufficient — photos live in MinIO, not Postgres. Including them makes the archive self-contained | HIGH | Must download from MinIO per-object and stream into ZIP. Photo path must be encoded in JSON so import can resolve |
| Dependency-ordered import | Tables have FK dependencies (users before reviews, places before reviews, etc.) — wrong order causes FK violation errors on insert | MEDIUM | Import engine must know and enforce the correct table insertion order |
| Per-entity type breakdown in summary | Admins managing 15+ tables need to know which entity types had issues, not just a global count | LOW | Report by table: `users: 200 imported, 5 skipped`, `places: 80 imported, 0 skipped`, etc. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Incremental / differential export | "Why export everything each time?" | Requires change tracking, snapshot diffing, merge logic on import — massive complexity. Export size is the wrong metric to optimize for reliability | Always export full state. Compression handles size. Simplicity prevents data loss |
| Scheduled automatic exports | "Set and forget backup" | Requires a cron/job system, file retention policy, storage for past exports, and alerting when jobs fail — a whole subsystem | Manual trigger from admin panel. If automation is needed, use OS-level cron calling an API endpoint in a future milestone |
| Export filtering (subset of data) | "I only want places, not users" | Partial exports contain dangling references — a Review without its User is invalid data. Referential integrity requires complete export | Always export everything. Filtering can be done by the admin post-download |
| Cross-version schema migration | "Import an old archive into the new schema" | Schema changes make old archives incompatible. Handling every past schema version requires a migration matrix — unbounded maintenance surface | Import expects same schema version. Version the archive format header and reject mismatches with a clear error |
| Real-time progress streaming (SSE/WebSocket) | "Show me a live progress bar during import" | Requires persistent connection, server-sent events or WebSocket, and state management across the operation — significant infra for marginal UX gain | Simple progress indication (spinner + "importing..." state) + summary report on completion is sufficient. Polling a status endpoint is acceptable if operation takes >30s |
| Inline error editing during import | "Let me fix bad rows and retry without re-uploading" | The SnackSpot admin is not a CSV-import tool — data has complex relationships across 15 tables, not a flat spreadsheet | Surface errors in the summary report with enough detail (entity type, field, reason) that admins can fix the source data and re-export |
| Overwrite-on-duplicate (upsert) | "Update existing records with newer data from archive" | Which instance's data is authoritative? Upsert creates ambiguous partial states and silent data destruction. The skip-on-duplicate strategy is safer and auditable | Skip duplicates and report counts. Admins who need to update existing records should use the admin CRUD UI |

## Feature Dependencies

```
Streaming ZIP Generation
    └──requires──> HTTP Response Streaming (Next.js API route)
    └──requires──> MinIO client for photo download

Full Data Export
    └──requires──> Streaming ZIP Generation
    └──requires──> PostGIS Geography Serialization (GeoJSON)
    └──requires──> Relationship Preservation (ordered JSON)

Import Validation
    └──requires──> Schema validation (JSON structure check)
    └──requires──> Referential integrity check (do referenced IDs exist in archive?)

ID Remapping
    └──requires──> Import Validation (must validate before building ID map)
    └──requires──> Dependency-Ordered Import (remap must happen in FK-safe order)

Photo Import
    └──requires──> ID Remapping (photo records reference remapped review/place IDs)
    └──requires──> MinIO client for photo upload

Import Summary Report
    └──requires──> ID Remapping (to count imported vs skipped)
    └──requires──> Import Validation (to count errors)

Skip-on-Duplicate Strategy ──enhances──> Import Validation
PostGIS Serialization ──enhances──> Full Data Export
Per-entity breakdown ──enhances──> Import Summary Report

Incremental Export ──conflicts──> Skip-on-Duplicate Strategy (differential imports require merge, not skip)
Overwrite-on-Duplicate ──conflicts──> Skip-on-Duplicate Strategy
```

### Dependency Notes

- **Streaming ZIP Generation requires HTTP Response Streaming:** Next.js API routes support streaming responses via `res.pipe()` or `ReadableStream` — this is the output channel for the export. The entire export flow is a pipeline from DB/MinIO into the HTTP response.
- **ID Remapping requires Dependency-Ordered Import:** The ID map for table A (e.g. users) must be fully built before table B (e.g. reviews) is imported, because B's foreign keys reference A's new IDs. Order is non-negotiable.
- **Photo Import requires ID Remapping:** `ReviewPhoto` records reference both `reviewId` and a `photoId` — both must be remapped before photo file-to-record association can be written.
- **Incremental Export conflicts with Skip-on-Duplicate:** The skip strategy assumes a full-state archive. A differential archive would contain only new records, making it impossible to determine which existing records are "duplicates" vs "intentionally absent."

## MVP Definition

### Launch With (v1)

Minimum viable — what's needed for a complete, usable export/import cycle.

- [ ] Streaming ZIP export (all DB tables as JSON + all MinIO photos) — the export is the atomic unit of value
- [ ] PostGIS geography serialization via GeoJSON — without this, place locations are corrupted on round-trip
- [ ] Import validation (schema + referential integrity) before any DB writes — correctness guarantee
- [ ] ID remapping on import — required to import into non-empty instances (the common case)
- [ ] Dependency-ordered import — required for FK integrity; cannot import without this
- [ ] Duplicate detection with skip-on-duplicate — safe, auditable merge behavior
- [ ] Photo upload from archive to MinIO during import — without photos, import is incomplete
- [ ] Import summary report (created / skipped / errors per entity type) — required for admin confidence
- [ ] Auth-protected export and import endpoints — PII protection is non-negotiable
- [ ] Admin UI: export button + import file picker with summary display — the interface that ties it together

### Add After Validation (v1.x)

- [ ] Archive version header with schema version check — add when the schema has changed at least once post-launch; prevents silent incompatibility
- [ ] Export file size estimate before download — add if admins report confusion about large downloads
- [ ] Partial import retry (skip previously-imported records using import log) — add if admins frequently need to resume interrupted imports

### Future Consideration (v2+)

- [ ] Scheduled exports via cron API endpoint — only if manual exports prove insufficient for operational needs
- [ ] Export size reduction (exclude soft-deleted records, old notifications) — only if archive size becomes a real operational burden
- [ ] Multi-instance sync via import (push archive to secondary instance) — only if SnackSpot evolves to a multi-instance deployment model

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Streaming ZIP export | HIGH | MEDIUM | P1 |
| PostGIS GeoJSON serialization | HIGH | MEDIUM | P1 |
| Import validation (pre-write) | HIGH | HIGH | P1 |
| ID remapping | HIGH | HIGH | P1 |
| Dependency-ordered import | HIGH | MEDIUM | P1 |
| Skip-on-duplicate | HIGH | LOW | P1 |
| Photo archive inclusion (export) | HIGH | HIGH | P1 |
| Photo upload to MinIO (import) | HIGH | HIGH | P1 |
| Import summary report | HIGH | LOW | P1 |
| Auth protection | HIGH | LOW | P1 |
| Admin UI (export button + upload) | MEDIUM | LOW | P1 |
| Archive version header | MEDIUM | LOW | P2 |
| Per-entity error detail | MEDIUM | LOW | P2 |
| Export size estimate | LOW | LOW | P3 |
| Partial import retry | LOW | HIGH | P3 |
| Scheduled exports | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | phpMyAdmin / db tools | Enterprise (Dynamics 365, Salesforce) | SnackSpot approach |
|---------|----------------------|----------------------------------------|--------------------|
| Export format | SQL dump, CSV, JSON | Proprietary binary, BACPAC | ZIP (JSON + photo binaries) — application-level, not DB-level |
| Photo/binary handling | Not applicable (DB only) | Blob columns in dump | First-class: stream from MinIO into ZIP, restore to MinIO |
| Duplicate handling | None (would error on PK clash) | Configurable (insert/update/merge) | Skip-on-duplicate via unique business fields (email, name+address) |
| ID remapping | None | Configurable (preserve or generate new IDs) | Always remap — new UUIDs in target instance |
| Validation before write | None | Pre-import validation wizard | Schema + referential integrity check before any transaction opens |
| Progress reporting | Spinner | Detailed progress with row counts | Summary report on completion; spinner during operation |
| PostGIS / geo support | Via ST_AsText in SQL dump | Not applicable | GeoJSON (ST_AsGeoJSON / ST_GeomFromGeoJSON) |
| Auth scope | Database-level credentials | Admin role | Existing `requireAdmin()` JWT middleware |

## Sources

- Adobe Campaign import/export best practices: https://experienceleague.adobe.com/en/docs/campaign-classic/using/getting-started/importing-and-exporting-data/best-practices/import-export-best-practices
- Elastic Path import conflict resolution: https://documentation.elasticpath.com/commerce/docs/tools/import-export/import-conflict-resolution.html
- Smashing Magazine — Designing a usable data importer: https://www.smashingmagazine.com/2020/12/designing-attractive-usable-data-importer-app/
- Smart Interface Design Patterns — Bulk UX: https://smart-interface-design-patterns.com/articles/bulk-ux/
- Informatica import summary report fields: https://docs.informatica.com/master-data-management/customer-360/10-3-hotfix-1/user-guide/importing-data/import-summary-report.html
- PostGIS ST_AsGeoJSON docs: https://postgis.net/docs/ST_AsGeoJSON.html
- PostGIS ST_GeomFromGeoJSON docs: https://postgis.net/docs/ST_GeomFromGeoJSON.html
- node-archiver streaming ZIP: https://github.com/archiverjs/node-archiver
- Django dry-run mode for imports: https://adamj.eu/tech/2022/10/13/dry-run-mode-for-data-imports-in-django/
- Conflict resolution strategies in data sync: https://mobterest.medium.com/conflict-resolution-strategies-in-data-synchronization-2a10be5b82bc
- Salesforce import dry run (Trailhead): https://trailhead.salesforce.com/content/learn/projects/import-your-data-using-npsp-data-importer/perform-an-import-dry-run
- Microsoft Dynamics 365 database export: https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/administration/tenant-admin-center-database-export

---
*Feature research for: data export/import system in web admin panel (SnackSpot)*
*Researched: 2026-04-06*
