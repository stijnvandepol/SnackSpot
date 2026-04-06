# Architecture Research

**Domain:** Data export/import system — Next.js 15 + Prisma + PostgreSQL/PostGIS + MinIO
**Researched:** 2026-04-06
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
EXPORT FLOW
───────────────────────────────────────────────────────────────────

Admin Browser
    │  GET /api/export/download
    ▼
Admin Route Handler (apps/admin/app/api/export/download/route.ts)
    │  requireAdmin() guard
    │  Returns Response with ReadableStream body
    │  Headers: Content-Type: application/zip
    │           Content-Disposition: attachment; filename="snackspot-export-{date}.zip"
    ▼
Export Orchestrator (apps/admin/lib/export/orchestrator.ts)
    │  Queries DB tables in dependency order
    │  Streams each JSON manifest entry into archiver
    │  Fetches each photo from MinIO and streams into archiver
    ▼
archiver (streaming ZIP library)
    │  Serialises entries on-the-fly — no full file in RAM
    │  Piped into web ReadableStream via Node stream → iterator conversion
    ▼
Browser downloads ZIP


IMPORT FLOW
───────────────────────────────────────────────────────────────────

Admin Browser
    │  POST /api/import/upload  (multipart/form-data, ZIP file)
    ▼
Admin Route Handler (apps/admin/app/api/import/upload/route.ts)
    │  requireAdmin() guard
    │  Streams upload to tmp file via formData()
    ▼
Import Orchestrator (apps/admin/lib/import/orchestrator.ts)
    │
    ├─ Phase 1: Extraction
    │   unzipper reads ZIP entry-by-entry (streaming)
    │   Separates data.json manifest from photo binary entries
    │
    ├─ Phase 2: Validation
    │   Zod schemas validate each record from manifest
    │   Referential integrity pre-checked in memory
    │   PostGIS fields validated as GeoJSON Point
    │
    ├─ Phase 3: ID Remapping + Ordered Insertion
    │   ID map built: Map<sourceId, newId>
    │   Tables inserted in dependency order (see below)
    │   Duplicate detection via unique fields before insert
    │   Each inserted row's new ID stored in ID map
    │
    ├─ Phase 4: Photo Upload
    │   Photo binaries from ZIP streamed to target MinIO
    │   Photo DB records updated with new storageKey
    │
    └─ Phase 5: Report Generation
        Returns ImportResult summary (imported, skipped, errors)
    ▼
Admin Browser renders summary report
```

### Component Responsibilities

| Component | Responsibility | Location |
|-----------|---------------|----------|
| Export Route Handler | Auth guard, sets streaming response headers, delegates to orchestrator | `apps/admin/app/api/export/download/route.ts` |
| Export Orchestrator | Query DB tables, serialise PostGIS, build ZIP stream entry list | `apps/admin/lib/export/orchestrator.ts` |
| PostGIS Serialiser | Convert `geography(Point,4326)` to GeoJSON `{ lat, lng }` object via raw SQL `ST_AsGeoJSON()` | `apps/admin/lib/export/postgis.ts` |
| Photo Exporter | Stream each MinIO object into archiver as `photos/{storageKey}` entry | `apps/admin/lib/export/photos.ts` |
| Import Route Handler | Auth guard, receives multipart upload, writes to tmp, delegates to orchestrator | `apps/admin/app/api/import/upload/route.ts` |
| Import Orchestrator | Coordinates all import phases, builds summary report | `apps/admin/lib/import/orchestrator.ts` |
| ZIP Extractor | Streams ZIP entries using unzipper, yields manifest JSON and photo buffers | `apps/admin/lib/import/extractor.ts` |
| Import Validator | Zod schema validation for each record type | `apps/admin/lib/import/validator.ts` |
| ID Remapper | Maintains `Map<sourceId, destinationId>`, rewrites FK fields before insertion | `apps/admin/lib/import/id-remapper.ts` |
| Duplicate Detector | Queries for existing records by unique fields (email, username, name+address, slug) | `apps/admin/lib/import/duplicate-detector.ts` |
| Photo Importer | Streams photo buffers from ZIP entries into target MinIO bucket | `apps/admin/lib/import/photos.ts` |
| Export/Import UI | Admin dashboard page with download button and upload form + result display | `apps/admin/app/dashboard/export-import/page.tsx` |

## Recommended Project Structure

```
apps/admin/
├── app/
│   ├── api/
│   │   ├── export/
│   │   │   └── download/
│   │   │       └── route.ts        # GET — streams ZIP to browser
│   │   └── import/
│   │       └── upload/
│   │           └── route.ts        # POST — receives ZIP, runs import
│   └── dashboard/
│       └── export-import/
│           └── page.tsx            # UI: download button + upload form
└── lib/
    ├── export/
    │   ├── orchestrator.ts         # Entry point: builds archiver, pipes DB + photos
    │   ├── postgis.ts              # ST_AsGeoJSON helper, lat/lng extraction
    │   ├── photos.ts               # MinIO getObject → archiver.append()
    │   └── types.ts                # ExportManifest, ExportedRecord types
    └── import/
        ├── orchestrator.ts         # Entry point: coordinates all phases
        ├── extractor.ts            # unzipper streaming, yields manifest + photos
        ├── validator.ts            # Zod schemas per record type
        ├── id-remapper.ts          # Map<sourceId, newId> builder + FK rewriter
        ├── duplicate-detector.ts   # Unique field lookups before insert
        ├── inserter.ts             # Ordered Prisma inserts per table
        ├── photos.ts               # MinIO putObject per photo buffer
        └── types.ts                # ImportManifest, ImportResult types
```

### Structure Rationale

- **`lib/export/` and `lib/import/` are separate trees:** The two pipelines share no runtime logic. Keeping them separate prevents accidental coupling and makes each independently testable.
- **Thin route handlers:** Route handlers only authenticate, parse the HTTP boundary (headers, formData), and delegate. No business logic in routes.
- **`types.ts` per subtree:** Defines the manifest shape (the JSON file inside the ZIP) as the contract between export and import. Any schema change here is the single place to update.

## Architectural Patterns

### Pattern 1: Node Stream → Web ReadableStream Bridge (Export)

**What:** archiver emits a Node.js `Transform` stream. Next.js App Router route handlers require a Web `ReadableStream`. Bridge via async iterator.

**When to use:** Any time a Node.js streaming library must be returned from a Next.js App Router route handler.

**Trade-offs:** Minimal overhead; chunk-by-chunk forwarding means RAM usage stays flat regardless of ZIP size. No `Content-Length` header is possible (unknown at stream start), which is correct for chunked transfer.

**Example:**
```typescript
// apps/admin/app/api/export/download/route.ts
import archiver from 'archiver'

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req)
  if (admin instanceof Response) return admin

  const archive = archiver('zip', { zlib: { level: 6 } })
  await populateArchive(archive)  // adds entries, calls archive.finalize()

  const webStream = new ReadableStream({
    start(controller) {
      archive.on('data', (chunk: Buffer) =>
        controller.enqueue(new Uint8Array(chunk))
      )
      archive.on('end', () => controller.close())
      archive.on('error', (err) => controller.error(err))
    },
  })

  return new Response(webStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="snackspot-export-${Date.now()}.zip"`,
    },
  })
}
```

### Pattern 2: PostGIS Serialisation via ST_AsGeoJSON (Export) / ST_GeomFromGeoJSON (Import)

**What:** Prisma maps the `geography(Point,4326)` column as `Unsupported`, meaning it returns raw hex WKB from standard queries. Instead, use `$queryRaw` with PostGIS functions to read and write the column as plain GeoJSON.

**When to use:** Whenever reading or writing the `Place.location` column for serialisable output.

**Trade-offs:** One extra raw SQL call per table read/write. Avoids pulling in a WKB parsing library (`wkx`) and keeps the exported format human-readable.

**Export (read):**
```typescript
// apps/admin/lib/export/postgis.ts
const rows = await db.$queryRaw<Array<{
  id: string; name: string; address: string;
  lat: number; lng: number;
  created_at: Date; updated_at: Date;
}>>`
  SELECT
    id, name, address,
    ST_Y(location::geometry) AS lat,
    ST_X(location::geometry) AS lng,
    created_at, updated_at
  FROM places
`
```

**Import (write):**
```typescript
// apps/admin/lib/import/inserter.ts
await db.$executeRaw`
  INSERT INTO places (id, name, address, location, created_at, updated_at)
  VALUES (
    ${newId}, ${record.name}, ${record.address},
    ST_SetSRID(ST_MakePoint(${record.lng}, ${record.lat}), 4326)::geography,
    ${record.createdAt}, ${record.updatedAt}
  )
  ON CONFLICT DO NOTHING
`
```

### Pattern 3: ID Remapper — In-Memory Map per Table (Import)

**What:** During import, source IDs (from the ZIP) will not exist in the destination DB. Each inserted row gets a fresh `cuid()`. The ID remapper tracks `sourceId → newId` in a `Map<string, string>` so that child records can have their FK fields rewritten before insertion.

**When to use:** Every FK field on every record must be rewritten before the record is inserted.

**Trade-offs:** Requires insertion in strict dependency order (parents before children). The map lives in process memory — fine for typical datasets of tens of thousands of records.

**Example:**
```typescript
// apps/admin/lib/import/id-remapper.ts
export class IdRemapper {
  private maps = new Map<string, Map<string, string>>()

  register(table: string, sourceId: string, newId: string) {
    if (!this.maps.has(table)) this.maps.set(table, new Map())
    this.maps.get(table)!.set(sourceId, newId)
  }

  resolve(table: string, sourceId: string): string {
    const newId = this.maps.get(table)?.get(sourceId)
    if (!newId) throw new Error(`No mapping for ${table}:${sourceId}`)
    return newId
  }

  tryResolve(table: string, sourceId: string): string | null {
    return this.maps.get(table)?.get(sourceId) ?? null
  }
}
```

### Pattern 4: Streaming ZIP Extraction — Entry-by-Entry (Import)

**What:** The imported ZIP can be multi-GB. Read it entry-by-entry using `unzipper` so only one entry is in RAM at a time. The `data.json` manifest is parsed first (it must be the first entry in the ZIP); photo binary entries are collected as Buffers only when needed.

**When to use:** Any large ZIP that mixes JSON and binary content.

**Trade-offs:** Entry order matters — the exporter must guarantee `data.json` is the first entry. Photo entries can come in any order after that. `unzipper` handles the streaming correctly; `adm-zip` reads the full file into memory and must be avoided.

**Example:**
```typescript
// apps/admin/lib/import/extractor.ts
import unzipper from 'unzipper'
import fs from 'node:fs'

export async function extractZip(zipPath: string): Promise<{
  manifest: ExportManifest
  photos: Map<string, Buffer>
}> {
  const photos = new Map<string, Buffer>()
  let manifest: ExportManifest | null = null

  const directory = await unzipper.Open.file(zipPath)
  for (const entry of directory.files) {
    if (entry.path === 'data.json') {
      const content = await entry.buffer()
      manifest = JSON.parse(content.toString('utf8'))
    } else if (entry.path.startsWith('photos/')) {
      const key = entry.path.slice('photos/'.length)
      photos.set(key, await entry.buffer())
    } else {
      // Unknown entries: drain and skip
      await entry.autodrain()
    }
  }

  if (!manifest) throw new Error('ZIP missing data.json manifest')
  return { manifest, photos }
}
```

### Pattern 5: Ordered Insertion (Import)

**What:** Tables must be inserted in topological dependency order so that FK constraints are satisfied. The order is fixed and known from the schema — no runtime graph traversal needed.

**When to use:** Any database import where FK constraints are enforced.

**Required insertion order for this schema:**
```
1.  User                  — no FK dependencies
2.  Badge                 — no FK dependencies
3.  BlockedWord           — depends on User (createdBy)
4.  Place                 — no FK dependencies (PostGIS handled separately)
5.  Review                — depends on User, Place
6.  ReviewTag             — depends on Review
7.  Photo                 — depends on User (uploaderId)
8.  ReviewPhoto           — depends on Review, Photo
9.  Comment               — depends on User, Review
10. FlaggedComment        — depends on Comment
11. Report                — depends on User, Review, Photo (optional FKs)
12. ModerationAction      — depends on User
13. UserBadge             — depends on User, Badge
14. ReviewLike            — depends on User, Review
15. Favorite              — depends on User, Place
16. Notification          — depends on User, Review, Comment (optional FKs)
17. NotificationPreferences — depends on User
18. ReviewMention         — depends on Review, User
```

**Tables NOT exported** (session/auth data that is instance-specific and unsafe to transfer):
- `RefreshToken`, `PasswordResetToken`, `EmailVerificationToken`

## Data Flow

### Export Data Flow

```
Admin clicks "Download Export"
    │
    ▼
GET /api/export/download
    │  requireAdmin() → verified
    │
    ▼
Export Orchestrator
    │
    ├── $queryRaw → users[]          → JSON entry in ZIP: data.json / users[]
    ├── $queryRaw → places[]         → JSON entry (with lat/lng from ST_X/ST_Y)
    ├── db.review.findMany()         → JSON entry
    ├── db.reviewTag.findMany()      → JSON entry
    ├── db.photo.findMany()          → JSON entry
    ├── db.reviewPhoto.findMany()    → JSON entry
    ├── db.comment.findMany()        → JSON entry
    ├── db.flaggedComment.findMany() → JSON entry
    ├── db.report.findMany()         → JSON entry
    ├── db.moderationAction.findMany() → JSON entry
    ├── db.userBadge.findMany()      → JSON entry
    ├── db.badge.findMany()          → JSON entry
    ├── db.reviewLike.findMany()     → JSON entry
    ├── db.favorite.findMany()       → JSON entry
    ├── db.notification.findMany()   → JSON entry
    ├── db.notificationPreferences.findMany() → JSON entry
    ├── db.reviewMention.findMany()  → JSON entry
    └── db.blockedWord.findMany()    → JSON entry
    │
    │  All above assembled as single data.json (manifest)
    │  archiver.append(JSON.stringify(manifest), { name: 'data.json' })
    │
    ├── For each Photo.storageKey:
    │     minioClient.getObject(BUCKET, storageKey)
    │     → Node stream piped into archiver.append(stream, { name: `photos/${storageKey}` })
    │
    └── archive.finalize()
          │
          ▼ (streamed chunk-by-chunk)
Browser saves snackspot-export-{timestamp}.zip
```

### Import Data Flow

```
Admin selects ZIP file, clicks "Import"
    │
    ▼
POST /api/import/upload (multipart/form-data)
    │  requireAdmin() → verified
    │  formData.get('file') → write to /tmp/import-{timestamp}.zip
    │
    ▼
Import Orchestrator
    │
    ├── Phase 1: Extraction
    │     unzipper.Open.file(tmpPath)
    │     yields: manifest (data.json parsed) + photos Map<storageKey, Buffer>
    │
    ├── Phase 2: Validation
    │     For each record in manifest, validate with Zod schema
    │     Collect validation errors (don't abort — report at end)
    │     Validate GeoJSON lat/lng in place records
    │
    ├── Phase 3: Ordered Insertion with ID Remapping
    │     IdRemapper = new IdRemapper()
    │     DuplicateDetector queries existing records by unique fields
    │
    │     For each table in insertion order:
    │       For each record:
    │         if (duplicate detected) → skip, but still register ID map entry
    │                                    (existing record's DB id → source id mapping)
    │         else:
    │           newId = cuid()
    │           Rewrite all FK fields via IdRemapper.resolve()
    │           prisma[table].create({ data: { id: newId, ...rewrittenRecord } })
    │           IdRemapper.register(table, record.id, newId)
    │
    ├── Phase 4: Photo Upload
    │     For each photo in manifest:
    │       storageKey = photos.get(sourceStorageKey)
    │       if (buffer exists in ZIP):
    │         minioClient.putObject(BUCKET, newStorageKey, buffer)
    │       Update Photo record's storageKey if it changed
    │
    └── Phase 5: Report
          Return ImportResult {
            tables: { [table]: { imported: N, skipped: N, errors: N } },
            photos: { uploaded: N, skipped: N, errors: N },
            errors: ErrorDetail[]
          }
    │
    ▼
Admin sees summary table in UI
```

### Duplicate Detection Strategy

| Table | Unique Field(s) | On Duplicate |
|-------|----------------|--------------|
| User | `email`, `username` | Skip record; register existing DB ID in ID map |
| Place | `name` + `address` (combined) | Skip record; register existing DB ID in ID map |
| Badge | `slug` | Skip record; register existing DB ID in ID map |
| BlockedWord | `word` | Skip record |
| All others | Source `id` (cuid — collision extremely unlikely across instances) | Skip if ID already exists; otherwise insert with new ID |

**Critical:** When a duplicate is skipped, the existing destination record's ID must be registered in the ID map so that child records (e.g. Reviews that reference a duplicate User) can still be remapped correctly.

## Scaling Considerations

| Concern | Approach |
|---------|----------|
| Large ZIP (multi-GB) | Streaming on both export (archiver pipe) and import (unzipper + tmp file) — never load full ZIP in RAM |
| Many photos | Export: MinIO streams piped directly into archiver. Import: photos processed one at a time from ZIP buffer entries |
| Long-running import | Next.js API route has a default 60s timeout on Vercel; for self-hosted (this project) there is no hard limit. A 10k-record import with 100 photos should complete in under 30s |
| Prisma transaction scope | Do NOT wrap the entire import in a single `$transaction` — it holds a DB connection for the full duration and risks timeout. Use per-table sequential inserts; Prisma handles connection pooling |

## Anti-Patterns

### Anti-Pattern 1: Loading Full ZIP Into Memory

**What people do:** `const zip = new AdmZip(buffer)` after reading the entire upload with `req.arrayBuffer()`.

**Why it's wrong:** A 2GB archive consumes 2GB+ of Node.js heap. The process will OOM or be killed before the import starts.

**Do this instead:** Write the upload to a tmp file (`/tmp/import-{timestamp}.zip`), then open it with `unzipper.Open.file(path)` which reads entries on demand without full memory loading.

### Anti-Pattern 2: Using Prisma for PostGIS Read/Write

**What people do:** `db.place.findMany()` and then try to parse the `location` field as WKB hex.

**Why it's wrong:** Prisma maps `Unsupported("geography(Point,4326)")` as an opaque value. The raw WKB hex requires a separate parsing library (`wkx`) and is not human-readable in the export JSON.

**Do this instead:** Use `db.$queryRaw` with `ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat` for export, and `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography` in a `$executeRaw` for import. Keeps the export JSON clean (`{ lat, lng }`) and avoids a WKB library dependency.

### Anti-Pattern 3: One Giant DB Transaction for the Entire Import

**What people do:** Wrap all inserts in `prisma.$transaction(async (tx) => { ... })` for atomicity.

**Why it's wrong:** For large imports, this holds an open DB transaction for 10–60+ seconds, risking a `PrismaClientKnownRequestError` transaction timeout and preventing other DB operations.

**Do this instead:** Accept partial-success as a valid outcome (the import report communicates this). Use individual inserts. If strict atomicity is required for a subset of tables, wrap only that group in a short-lived transaction.

### Anti-Pattern 4: Re-using Source IDs Directly

**What people do:** Insert records with their original source IDs on the assumption that CUIDs won't collide across instances.

**Why it's wrong:** Two instances may have independently generated the same CUID (extremely unlikely but possible). More importantly, this prevents the skip-on-duplicate logic from working correctly — if the source ID exists in the destination for a different record, the insert will fail or silently corrupt data.

**Do this instead:** Always generate a fresh `cuid()` for each inserted record. Register the `sourceId → newId` mapping immediately after insert for FK rewrites in child tables.

### Anti-Pattern 5: Blocking the Event Loop During JSON Stringify/Parse

**What people do:** `JSON.stringify(allData)` in a single synchronous call where `allData` contains 50k records.

**Why it's wrong:** `JSON.stringify` is synchronous and blocks the Node.js event loop for 100–500ms on large datasets, making the admin app unresponsive during export.

**Do this instead:** Serialise each table separately (e.g. `manifest.users = users; manifest.places = places; ...`) and pass the manifest to `archiver.append()` once. For very large datasets (>100k rows), consider streaming JSON serialisation — but this is unlikely to be needed for this project's scale.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| MinIO | Export: `minioClient.getObject(BUCKET, key)` returns Node.js stream, pipe into archiver. Import: `minioClient.putObject(BUCKET, key, buffer)` | Admin app needs its own MinIO client (currently only `apps/web` has one). Create `apps/admin/lib/minio.ts` mirroring the web app pattern |
| PostgreSQL/PostGIS | Export: `db.$queryRaw` with `ST_X/ST_Y`. Import: `db.$executeRaw` with `ST_MakePoint` | PostGIS functions require the PostGIS extension (already installed) |
| Prisma | Standard `db[model].create()` for all non-PostGIS tables. `db.$queryRaw` for place reads | Admin app already has `apps/admin/lib/db.ts` — no new client needed |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Route Handler → Export Orchestrator | Direct async function call; orchestrator returns a Node.js stream (archiver instance) | Route handler converts stream to Web ReadableStream for Response body |
| Route Handler → Import Orchestrator | Direct async function call with tmp file path; orchestrator returns `ImportResult` | Tmp file cleaned up after orchestrator completes (success or error) |
| Export Orchestrator → MinIO | `minioClient.getObject()` per photo | Admin app needs its own `lib/minio.ts` — reuse same env vars |
| Import Orchestrator → MinIO | `minioClient.putObject()` per photo buffer | Same MinIO client |
| Import Orchestrator → Prisma | Sequential table inserts in dependency order | No shared transaction |
| Export/Import UI → Route Handlers | Fetch API — download via `<a href="/api/export/download">`, upload via `fetch('/api/import/upload', { method: 'POST', body: formData })` | No websockets; no polling needed for this scope |

## Build Order Implications

The components have the following dependencies that dictate build order across phases:

```
1. types.ts (ExportManifest, ImportResult shapes)
        │
        ├─── 2a. Export pipeline
        │         postgis.ts → orchestrator.ts → route handler → UI download button
        │
        └─── 2b. Import pipeline (can start after types.ts, but logically after export works)
                  validator.ts
                  id-remapper.ts
                  duplicate-detector.ts
                  extractor.ts
                  inserter.ts  (depends on id-remapper + duplicate-detector)
                  photos.ts
                  orchestrator.ts (ties everything together)
                  route handler
                  UI upload form + result display
```

**Recommended phase split:**

| Phase | Components | Why this order |
|-------|-----------|----------------|
| Phase 1 | `types.ts`, MinIO client for admin, Export orchestrator, Download route, Download UI | Export is simpler (read-only), validates the manifest format before import must consume it |
| Phase 2 | Import extractor, validator, ID remapper, duplicate detector, inserter (DB-only, no photos first), Import route, Basic import UI | Get relational data working before adding the photo complexity |
| Phase 3 | Photo import (`lib/import/photos.ts`), photo export integration, full end-to-end test | Photos are independent of the data pipeline; can be added once the core is verified |

## Sources

- archiver npm package (streaming ZIP generation): https://www.archiverjs.com/
- unzipper streaming extraction: https://github.com/mhr3/unzip-stream
- Next.js App Router streaming files: https://www.ericburel.tech/blog/nextjs-stream-files
- PostGIS ST_AsGeoJSON / ST_MakePoint: https://postgis.net/docs/ST_AsGeoJSON.html
- MinIO JavaScript SDK getObject/putObject: https://github.com/minio/minio-js
- Prisma transactions reference: https://www.prisma.io/docs/v6/orm/prisma-client/queries/transactions

---
*Architecture research for: SnackSpot export/import system*
*Researched: 2026-04-06*
