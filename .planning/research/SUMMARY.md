# Project Research Summary

**Project:** SnackSpot Admin — Export/Import Milestone
**Domain:** ZIP-based full-data export/import for a Next.js 15 admin panel
**Researched:** 2026-04-06
**Confidence:** HIGH

## Executive Summary

SnackSpot needs a ZIP-based export/import system that moves the entire application dataset — 18 relational tables plus MinIO-hosted photo binaries — between instances. The feature must work end-to-end: one ZIP download contains every database record as JSON plus every photo binary, and that ZIP can be re-imported into a target instance (possibly non-empty) with full referential integrity preserved. Experts build this class of feature with a fully streaming pipeline. Nothing is buffered in Node.js memory: the export piping DB query results and MinIO object streams directly into an `archiver` ZIP that is simultaneously streamed to the HTTP response, and the import reading the uploaded ZIP entry-by-entry via `unzipper` without landing the full archive on disk.

The recommended approach uses five focused libraries — `archiver`, `unzipper`, `@fastify/busboy`, `p-limit`, and `zod` (already installed) — on top of the existing stack (Next.js 15, Prisma 5, PostgreSQL/PostGIS, MinIO). No ORM-level abstractions are available for PostGIS geography columns; those require raw SQL via `prisma.$queryRaw` with `ST_AsGeoJSON` / `ST_MakePoint`. Import correctness depends on three mechanisms that must be built in concert: a hardcoded 18-table insertion order derived from the FK dependency graph, an in-memory `IdRemapper` that rewrites every FK field (including all components of compound primary keys) before insertion, and a duplicate-detection strategy keyed on business-unique fields (email/username for users, name+address for places, slug for badges).

The dominant risks are all precision/correctness issues that are invisible without deliberate tests: PostGIS location silently absent from Prisma query results, `Prisma.Decimal` rating fields that crash `JSON.stringify`, compound-key FK remapping that is easily forgotten, and the 4.29 GB ZIP32 size limit that produces a corrupt archive without warning. Every one of these has a known, deterministic fix — none require architectural changes if addressed in the right phase. Security hygiene requires explicitly excluding the three token tables (`RefreshToken`, `PasswordResetToken`, `EmailVerificationToken`) from the export because they are both operationally useless on import and constitute a credential exposure risk if included.

---

## Key Findings

### Recommended Stack

The existing SnackSpot admin stack needs five additions. `archiver` (^7.0.1) handles streaming ZIP creation — its pipe-to-HTTP-response pattern keeps RAM flat regardless of archive size, which is the correct architecture for multi-GB archives with hundreds of photos. `unzipper` (^0.12.x) handles streaming ZIP extraction entry-by-entry during import. `@fastify/busboy` (^3.x) parses the multipart upload in the App Router route handler without writing a temp file or buffering the body. `p-limit` (^6.x) caps concurrent MinIO photo fetches during export at 5 to avoid connection pool exhaustion. `zod` is already installed and covers import manifest validation.

PostGIS serialization requires raw SQL exclusively — Prisma marks `geography(Point,4326)` as `Unsupported` and silently omits it from standard query results. `ST_X/ST_Y` (export) and `ST_SetSRID(ST_MakePoint(...), 4326)::geography` (import) are the correct PostGIS 3.x patterns. `Prisma.Decimal` rating fields must be serialized with `.toString()` to avoid JSON serialization errors and precision loss.

**Core technologies:**
- `archiver` ^7.0.1: streaming ZIP generation — only streaming library with a high-level pipe/glob API suitable for multi-GB archives
- `unzipper` ^0.12.x: streaming ZIP extraction — active fork of node-unzip, correct streaming-first architecture
- `@fastify/busboy` ^3.x: multipart upload parsing — actively maintained, streaming-first, no temp-disk writes
- `p-limit` ^6.x: concurrency control for MinIO photo fetches — prevents OOM and connection pool exhaustion
- `zod` (existing): import manifest validation — already installed, `.safeParse()` for per-row error collection
- Raw SQL via `prisma.$queryRaw`: PostGIS geography serialization — only supported path for `Unsupported` column types
- `prisma.createMany` + `skipDuplicates`: batch DB inserts — avoids N+1 round trips, PostgreSQL-native `ON CONFLICT DO NOTHING`
- `minio` ^8.0.3 (add to admin): photo streaming — `getObject` returns `Readable` stream for direct pipe into archiver

### Expected Features

All features listed below are required for a complete, usable export/import cycle. There is no safe subset: an export without photos is incomplete, an import without ID remapping fails on non-empty targets, and an import without a summary report leaves admins unable to confirm success.

**Must have (table stakes):**
- Streaming ZIP export (all DB tables as JSON + all MinIO photos) — the atomic unit of value
- PostGIS geography serialization via GeoJSON — without this, Place locations are silently corrupted
- Import validation (schema + referential integrity check) before any DB writes — correctness guarantee
- ID remapping on import — required for non-empty target instances (the common case)
- Dependency-ordered import (18-table FK-safe sequence) — required for FK integrity
- Duplicate detection with skip-on-duplicate — safe, auditable merge behavior
- Photo upload from archive to MinIO during import — without photos the import is incomplete
- Import summary report (created/skipped/errors per entity type) — required for admin confidence
- Auth-protected endpoints via existing `requireAdmin()` middleware — PII protection
- Admin UI: export button + import file picker with summary display

**Should have (differentiators):**
- Archive version header with schema version check — prevents silent incompatibility after schema changes
- Per-entity error detail in summary — admins managing 15+ tables need table-level breakdown, not a global count
- Export file size estimate before download — addresses confusion about large downloads

**Defer (v2+):**
- Scheduled automatic exports — requires a full cron/alerting subsystem; manual trigger is sufficient
- Export filtering (subset of data) — partial exports produce dangling FK references; always export full state
- Incremental/differential export — requires change tracking and merge logic; complexity far exceeds value
- Real-time progress streaming (SSE/WebSocket) — spinner + summary report is sufficient for this scale

### Architecture Approach

The system is two independent streaming pipelines sharing a common manifest type definition. The export pipeline: Route Handler (auth) → Export Orchestrator (queries DB + MinIO) → `archiver` (streaming ZIP) → Node stream → Web `ReadableStream` bridge → HTTP response. The import pipeline: Route Handler (auth + multipart) → temp file write → Import Orchestrator → Phase 1 extraction (`unzipper`) → Phase 2 validation (`zod`) → Phase 3 ordered insertion with ID remapping → Phase 4 photo upload to MinIO → Phase 5 summary report. The two pipelines are deliberately separate trees (`lib/export/` and `lib/import/`) to prevent accidental coupling and allow independent testing. Route handlers are thin: auth, HTTP boundary parsing, delegate to orchestrator.

**Major components:**
1. `lib/export/orchestrator.ts` — queries all 18 tables in dependency order, serializes PostGIS fields via raw SQL, builds archiver ZIP stream
2. `lib/export/postgis.ts` — `ST_X/ST_Y` raw SQL helper for Place records; single point of change for geography serialization
3. `lib/export/photos.ts` — streams MinIO objects directly into archiver entries without buffering
4. `lib/import/orchestrator.ts` — coordinates all 5 import phases, builds and returns `ImportResult` summary
5. `lib/import/extractor.ts` — `unzipper` streaming extraction, yields manifest JSON and photo buffers
6. `lib/import/validator.ts` — Zod schemas per record type, collects errors without aborting
7. `lib/import/id-remapper.ts` — `Map<sourceId, newId>` per table, FK rewrite before every insert
8. `lib/import/duplicate-detector.ts` — unique-field lookups (email/username, name+address, slug) before insert
9. `lib/import/inserter.ts` — ordered Prisma inserts; raw SQL for PostGIS tables
10. `apps/admin/app/api/export/download/route.ts` and `apps/admin/app/api/import/upload/route.ts` — thin route handlers

### Critical Pitfalls

1. **PostGIS location silently omitted by Prisma** — `prisma.place.findMany()` returns Place records with no `location` field and no error. Use `prisma.$queryRaw` with `ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat` for every Place export query. Verify with an integration test that checks the exported JSON for valid lat/lng values.

2. **`Prisma.Decimal` fields crash or corrupt JSON.stringify** — Rating fields (`rating`, `ratingTaste`, etc.) are `Decimal.js` objects that are not JSON-serializable by default. Write a `serializeDecimal(d: Prisma.Decimal | null): string | null` helper using `.toString()` and apply it to every rating field before serializing to JSON. Use `new Prisma.Decimal(value)` on import. Never coerce to `Number`.

3. **Import order violations on the 18-table FK dependency chain** — Inserting in the wrong order produces `ForeignKeyConstraintViolation` errors. Hardcode an `IMPORT_ORDER` constant array in the correct topological sequence (Badge → User → Place → BlockedWord → Review → Photo → Comment → ReviewTag → ReviewLike → ReviewPhoto → Favorite → UserBadge → Report → ModerationAction → ReviewMention → FlaggedComment → Notification → NotificationPreferences) and write a unit test that validates every table appears after all its FK dependencies.

4. **Compound primary key remapping is silently incomplete** — `ReviewLike`, `Favorite`, `ReviewPhoto`, `UserBadge`, `ReviewTag` use compound PKs. When a referenced parent record is a duplicate (existing user/place), the FK columns of these junction tables must be remapped via the ID map before construction — not after. Test by importing a dataset where all users and places already exist in the target; junction table rows must use target IDs.

5. **Streaming not actually streaming — photo buffer accumulation causes OOM** — The intuitive pattern `await minioClient.getObject()` → collect buffer → append to archive is fully buffered. For 1000+ photos this crashes the Node.js process. Pipe the MinIO `Readable` stream directly into `archive.append(stream, { name: ... })` without awaiting a buffer. Enable `forceZip64: true` on the archiver to avoid the 4.29 GB ZIP32 size limit.

6. **Security token tables in export archive** — `RefreshToken`, `PasswordResetToken`, `EmailVerificationToken` must be explicitly excluded from the export. They are meaningless cross-instance and constitute a credential exposure risk. Hardcode an exclusion list; document it in the manifest.

7. **Partial import leaves inconsistent DB state** — Per-table commits with no outer rollback produce an unrecoverable partial state on failure. Use a dry-run validation phase (validate all records before any writes) as the primary safeguard. For strict atomicity requirements, use `prisma.$transaction(fn, { timeout: 300_000 })` with an explicit timeout, or accept partial-success as the documented behavior and surface it clearly in the summary report.

---

## Implications for Roadmap

Based on the combined research, the feature naturally decomposes into three phases that follow the export-before-import dependency and add photo complexity last. All three phases are within v1 scope — none can be deferred.

### Phase 1: Foundation — Types, MinIO Client, Export Pipeline

**Rationale:** Export is read-only and simpler than import. Building it first validates the manifest format (the `data.json` contract) before the import pipeline must consume it. The Node stream → Web ReadableStream bridge and PostGIS raw SQL patterns must be proven here before import can reuse them. The admin MinIO client is needed for both pipelines and must exist before either can work.

**Delivers:**
- `lib/export/types.ts` — `ExportManifest` and per-table record shapes; the contract between export and import
- `lib/admin/minio.ts` — MinIO client for the admin app (currently only in `apps/worker`)
- Full export pipeline: PostGIS serializer, photo exporter, orchestrator, route handler
- Admin UI: download button with spinner, `Content-Disposition` ZIP download
- Working export verified end-to-end: downloaded ZIP contains valid JSON with lat/lng for places and all photo binaries

**Addresses features:** Streaming ZIP export, PostGIS geography serialization, photo binary inclusion, auth-protected export endpoint, export UI

**Avoids pitfalls:** PostGIS silent omission (fixed in this phase), OOM photo buffering (streaming architecture established here), token table inclusion (exclusion list defined here), ZIP32 4GB limit (`forceZip64: true` set here)

**Research flag:** Standard patterns — streaming ZIP + Next.js App Router file download is well-documented. No phase-level research needed.

---

### Phase 2: Import Pipeline — Relational Data (No Photos)

**Rationale:** Import is significantly more complex than export. Tackling it without the photo dimension first isolates the hardest problems — FK ordering, ID remapping, duplicate detection, Decimal serialization — and allows them to be tested against the manifest produced by Phase 1. Photos are independent of the relational data pipeline and can be added in Phase 3 once correctness is established.

**Delivers:**
- Import extractor (`unzipper` streaming from temp file)
- Zod validators per record type (including Decimal string format)
- `IdRemapper` class with compound-key support
- `DuplicateDetector` with unique-field lookups
- Ordered inserter for all 18 tables (including PostGIS raw SQL for Place)
- Import route handler (multipart via `@fastify/busboy`, temp file write)
- Import summary report structure (`ImportResult` type)
- Admin UI: upload form, import state (spinner + summary display)
- Import idempotency verified: re-running same archive produces zero new records

**Addresses features:** Import validation, ID remapping, dependency-ordered import, skip-on-duplicate, import summary report, auth-protected import endpoint, import UI

**Avoids pitfalls:** FK dependency order violations (IMPORT_ORDER constant defined and tested), compound key remapping (ID map applied to all FK components before construction), Decimal precision loss (serializeDecimal helper in place from Phase 1), partial import inconsistency (dry-run validation before writes), Next.js body size limit (busboy streaming architecture)

**Research flag:** Standard patterns — Prisma ordered inserts, in-memory ID remapping, Zod validation are well-documented. No phase-level research needed.

---

### Phase 3: Photo Import + End-to-End Validation

**Rationale:** Photo import is architecturally independent from the relational data pipeline but depends on the ID remapper being complete (PhotoRecord references remapped reviewId/uploaderId). Adding it last means Phase 2 produces a testable, correct relational import before photo complexity is introduced. This phase also contains all cross-cutting integration tests that validate the full round-trip.

**Delivers:**
- `lib/import/photos.ts` — streams photo buffers from ZIP entries to target MinIO (upload-before-DB-record ordering)
- Photo import integrated into import orchestrator (Phase 4 of 5)
- Photo storageKey remapping in Photo DB records post-upload
- Full end-to-end test: export from populated instance → import to empty instance → verify all counts, lat/lng values, photo checksums, junction table IDs
- Load test: export + import with 2000+ synthetic photos, heap stays below 512 MB
- Security test: confirm token table files absent from archive
- Idempotency test: second import of same archive produces zero new records

**Addresses features:** Photo upload from archive to MinIO during import, per-entity type breakdown in summary (photos: uploaded/skipped/errors)

**Avoids pitfalls:** MinIO upload before DB record (upload confirmed before Photo DB record created), photo binary integrity (checksum verified post-import)

**Research flag:** Standard patterns — MinIO `putObject` with buffer is well-documented. No phase-level research needed.

---

### Phase Ordering Rationale

- **Export before import:** The import pipeline consumes the manifest format produced by export. Building export first creates a real artifact to test against rather than writing import code against a hypothetical schema.
- **Relational data before photos:** FK ordering, ID remapping, and Decimal serialization are the hardest correctness problems. Isolating them in Phase 2 keeps the first import iteration fast to iterate on.
- **Types first within each phase:** `lib/export/types.ts` (ExportManifest) is the contract between export and import. It must be defined and stable before either pipeline is built.
- **All three phases are v1:** There is no safe partial delivery. An export without photos is unusable. An import without ID remapping fails on any non-empty instance. A feature with no import UI has no admin-facing value.

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 1 (Export Pipeline):** Node.js streaming ZIP + Next.js App Router file download is well-documented with official examples. PostGIS `ST_AsGeoJSON` is stable PostGIS 3.x. MinIO `getObject` stream API is in official SDK docs.
- **Phase 2 (Import — Relational):** Prisma ordered inserts, Zod schema validation, in-memory ID mapping are all canonical patterns with extensive documentation.
- **Phase 3 (Photo Import):** MinIO `putObject` buffer upload is straightforward SDK usage. End-to-end test patterns are standard.

No phase in this milestone requires a `/gsd-research-phase` call during planning. All key decisions are resolved: library selection, streaming architecture, FK ordering, ID remapping strategy, duplicate detection fields, security exclusions.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All library recommendations verified against npm registry, GitHub activity, and official documentation. `archiver` v7 (March 2024), `unzipper` active in 2025, `p-limit` actively maintained by sindresorhus. One caveat: `p-limit` v5+ is pure ESM — verify `tsconfig.json` module resolution before pinning version. |
| Features | HIGH | Core patterns (streaming export, ID remapping, duplicate detection, dependency-ordered import) are well-established across enterprise import tools. Anti-features are correctly identified as complexity traps. MVP definition is conservative and correct. |
| Architecture | HIGH | Component boundaries, data flow, and file structure are derived from the actual codebase (`apps/admin`, existing Prisma schema). Phase split follows natural dependencies. Code examples are syntactically correct for Next.js 15 App Router. |
| Pitfalls | HIGH | Schema inspected directly (`packages/db/prisma/schema.prisma`). All critical pitfalls are verified against official Prisma issues, PostGIS documentation, and archiver GitHub issues. Recovery strategies are concrete. |

**Overall confidence:** HIGH

### Gaps to Address

- **`p-limit` ESM compatibility:** If `apps/admin` compiles to CommonJS output, `p-limit` v5+ will fail at runtime with an ESM import error. Check `apps/admin/tsconfig.json` `module` setting before installation; pin to `p-limit@4` if CJS output is required. Resolve in Phase 1 during dependency installation.

- **`@types/archiver` v7 coverage:** The DefinitelyTyped package may lag behind archiver v7. If types are incomplete, a minimal `declare module 'archiver'` shim is the fallback. Verify at Phase 1 install time.

- **Transaction rollback strategy decision:** PITFALLS.md presents two valid approaches (dry-run validation before any writes vs. single outer `$transaction` with explicit timeout). The roadmap must decide which one to implement. Dry-run is recommended — it avoids the large-transaction timeout risk while providing the same correctness guarantee for well-formed archives.

- **Photo storageKey format in target MinIO:** If the target instance uses a different MinIO bucket name or key prefix than the source, photo storageKeys written to `Photo.storageKey` during import will be wrong. Confirm whether the bucket name is hardcoded or configurable before Phase 3 begins.

- **`archiver` v7 `@types` coverage:** Verify before installing that `@types/archiver` covers the v7 API surface, specifically the `zip` plugin options including `forceZip64`. If not, this is a known gap to shim.

---

## Sources

### Primary (HIGH confidence)
- `packages/db/prisma/schema.prisma` — source of truth for all table shapes, FK relationships, and `Unsupported` column declarations
- https://github.com/archiverjs/node-archiver — archiver v7.0.1 streaming API, `forceZip64` option
- https://postgis.net/docs/ST_AsGeoJSON.html — `ST_AsGeoJSON`, `ST_X`, `ST_Y`, `ST_MakePoint`, `ST_SetSRID`
- https://www.prisma.io/docs/orm/prisma-client/queries/crud — `createMany` + `skipDuplicates` PostgreSQL support
- https://www.prisma.io/docs/orm/prisma-client/queries/transactions — `$transaction` timeout configuration
- https://docs.min.io/enterprise/aistor-object-store/developers/sdk/javascript/api/ — MinIO JS SDK `getObject`/`putObject` streaming API

### Secondary (MEDIUM confidence)
- https://snyk.io/advisor/npm-package/unzipper — `unzipper` maintenance status (Jan 2025 confirmed active)
- https://github.com/fastify/busboy — `@fastify/busboy` as actively maintained fork of `busboy`
- https://freddydumont.com/blog/prisma-postgis — Prisma + PostGIS raw SQL patterns
- https://github.com/sindresorhus/p-limit — `p-limit` v6/v7 ESM-only status

### Tertiary (supporting)
- https://github.com/prisma/prisma/issues/2789 and #25768 — Prisma `Unsupported` geography field behavior (confirmed not returning data from findMany)
- https://github.com/prisma/prisma/issues/9170 — Prisma Decimal JSON serialization behavior
- https://github.com/archiverjs/node-archiver/issues/179 — ZIP32 4GB limit in archiver; `forceZip64` workaround
- https://www.pkgpulse.com/blog/archiver-vs-adm-zip-vs-jszip-zip-archive-creation-2026 — 2026 comparison confirming `archiver` as the appropriate choice for server-side streaming

---
*Research completed: 2026-04-06*
*Ready for roadmap: yes*
