# Phase 01: Foundation + Export Pipeline - Research

**Researched:** 2026-04-06
**Domain:** Streaming ZIP generation, PostGIS serialization, Prisma Decimal, Next.js API route streaming, MinIO object streaming
**Confidence:** HIGH

## Summary

This phase delivers the full export pipeline: a new admin page with an export button, a streaming ZIP download endpoint, an admin MinIO client, and serialization handling for PostGIS geography and Prisma Decimal fields.

The codebase already provides the exact patterns needed. The `apps/web/app/api/v1/photos/variant/route.ts` file demonstrates the exact `Readable.toWeb()` bridge from a Node.js Readable to a Web `ReadableStream` — this is the correct pattern for streaming the archiver output to the Next.js response. The `apps/web/lib/review-helpers.ts` file shows the established `Number(item.rating)` pattern for Decimal serialization.

The only new external dependency needed is `archiver` (v7.0.1, CJS, no ESM compatibility concern). `p-limit` is ESM-only (v7.x) and should be avoided; instead the export should use a simple sequential loop with `await` for photo streaming, which is sufficient given the export is a one-at-a-time admin operation.

**Primary recommendation:** Pipe `archiver` into a Node.js `PassThrough`, bridge with `Readable.toWeb()`, return as a `ReadableStream` response. Use `db.$queryRaw` with `ST_Y`/`ST_X` for places. Serialize Decimal fields with `Number()`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Dedicated "Export / Import" page in the admin sidebar navigation — export button lives here, import UI will be added in Phase 2
- **D-02:** During export generation, the button shows a spinner and disables. No progress streaming needed — browser handles the download when the response completes
- **D-03:** Nested folder layout inside the ZIP: `data/` for JSON files (one per table), `photos/` for photo binaries, `manifest.json` at root
- **D-04:** Each table gets its own JSON file in `data/` (e.g., `data/users.json`, `data/places.json`, `data/reviews.json`)
- **D-05:** Photos stored flat in `photos/` by their storage key / photo ID
- **D-06:** Export all 18 non-token tables: User, Place, Review, Photo, ReviewPhoto, Comment, Badge, UserBadge, ReviewLike, Favorite, Report, ModerationAction, Notification, NotificationPreferences, ReviewMention, ReviewTag, BlockedWord, FlaggedComment
- **D-07:** Exclude token tables: RefreshToken, PasswordResetToken, EmailVerificationToken (security + operationally useless cross-instance)
- **D-08:** Decimal ratings serialized as JSON numbers (e.g., `4.5`), not strings or objects — requires explicit conversion from Prisma Decimal objects
- **D-09:** PostGIS geography data serialized as GeoJSON `{lat, lng}` objects (per EXP-03)
- **D-10:** JSON columns (Photo.variants, Photo.metadata) exported as-is — they're already JSON-serializable
- **D-11:** Export original uploaded photos only (stored as `{photoId}` in MinIO). Processed variants (thumb/medium/large WebP) are excluded
- **D-12:** Photos stored in ZIP as `photos/{storageKey}` — flat, no subdirectories per photo

### Claude's Discretion
- Exact manifest.json schema (must include schema version per INF-03, other metadata fields are flexible)
- Streaming implementation details (archiver configuration, compression level)
- Admin MinIO client module structure (following existing `apps/web/lib/minio.ts` pattern)
- Error handling for missing/inaccessible photos during export (skip with warning vs fail)
- Export API route structure (`/api/export` or similar)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXP-01 | Admin can export all data + photos as a ZIP download via a dashboard button | D-01 sidebar page + streaming GET endpoint pattern documented |
| EXP-02 | Export contains JSON files per table with all records and relationships | D-04 + D-06 table list confirmed against schema; Prisma `findMany` with no pagination |
| EXP-03 | PostGIS geography data is serialized as GeoJSON (lat/lng) | `$queryRaw` + `ST_Y`/`ST_X` pattern confirmed from existing codebase |
| EXP-04 | Decimal ratings are correctly serialized (not as empty objects) | `Number(decimal)` pattern confirmed from `review-helpers.ts` |
| EXP-05 | Photos are streamed from MinIO and included in the ZIP archive | `minioClient.getObject()` → archiver `append()` pattern |
| EXP-06 | ZIP is generated via streaming (no full in-memory buffering) | archiver v7 + PassThrough + `Readable.toWeb()` pattern confirmed |
| EXP-07 | Token tables excluded from export | D-07 lockeed; table list excludes RefreshToken, PasswordResetToken, EmailVerificationToken |
| EXP-08 | Export includes a manifest with schema version and metadata | manifest.json at ZIP root, schema flexible per Claude's Discretion |
| INF-01 | All endpoints behind existing `requireAdmin()` auth middleware | Pattern confirmed — same guard used by all 16 existing admin routes |
| INF-02 | Admin app gets its own MinIO client (reuses existing config) | New `apps/admin/lib/minio.ts` + env.ts extension needed |
| INF-03 | Schema version in export manifest | Manifest field; import phase will validate on read |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| archiver | 7.0.1 | Streaming ZIP archive generation | CJS module, pipes directly to Node.js streams; industry standard for Node ZIP streaming |
| @types/archiver | 7.0.0 | TypeScript definitions for archiver | Covers archiver v7 API [VERIFIED: npm registry] |
| minio | 8.0.3 (already installed) | MinIO S3 client | Already in use by web app; admin gets its own client instance |
| @prisma/client | 5.22.0 (already installed) | Database access + raw SQL for PostGIS | Already in use |
| zod | 3.23.8 (already installed) | Env var validation extension | Already in admin `lib/env.ts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:stream | built-in | `PassThrough`, `Readable.toWeb()` | Bridge archiver (Node stream) to Next.js `Response` (Web stream) |
| node:stream/web | built-in | `ReadableStream` type | Already used in web app variant proxy route |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| archiver | jszip, adm-zip | Both buffer entire archive in memory — not viable for multi-GB export |
| archiver | zip-stream (direct) | archiver wraps zip-stream with better API; direct zip-stream requires more boilerplate |
| sequential photo loop | p-limit concurrency | p-limit v7 is ESM-only (confirmed: `require('p-limit')` fails); sequential is safe and simpler for a one-admin-at-a-time operation |

**Installation (new dependencies only):**
```bash
pnpm --filter @snackspot/admin add archiver
pnpm --filter @snackspot/admin add -D @types/archiver
```

**Version verification:** [VERIFIED: npm registry]
- `archiver`: 7.0.1 (published 2024)
- `@types/archiver`: 7.0.0
- `minio`: 8.0.3 (already in `apps/web/package.json`)
- `p-limit` is NOT recommended — ESM-only confirmed by runtime test

---

## Architecture Patterns

### Recommended File Structure (new files only)
```
apps/admin/
├── app/
│   ├── api/
│   │   └── export/
│   │       └── route.ts          # GET — streams ZIP to browser
│   └── dashboard/
│       └── export/
│           └── page.tsx           # "Export / Import" admin page (Phase 1: export UI only)
└── lib/
    └── minio.ts                   # Admin MinIO client (mirrors apps/web/lib/minio.ts)
```

### Pattern 1: Streaming ZIP Response via archiver + Readable.toWeb()

**What:** archiver pipes into a Node.js `PassThrough`; the `PassThrough` is bridged to a Web `ReadableStream` with `Readable.toWeb()` and returned as the `Response` body.

**When to use:** Any Next.js App Router API route that needs to stream a large binary (ZIP, CSV, etc.) without buffering.

**Why this works:** Next.js 15 API routes support Web `ReadableStream` as a `Response` body. The web app already uses this exact bridge in `apps/web/app/api/v1/photos/variant/route.ts` (line 45: `Readable.toWeb(objectStream)`).

```typescript
// Source: apps/web/app/api/v1/photos/variant/route.ts (established pattern)
import { PassThrough, Readable } from 'node:stream'
import archiver from 'archiver'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof Response) return auth

  const pass = new PassThrough()
  const archive = archiver('zip', { zlib: { level: 6 } })

  archive.on('error', (err) => {
    pass.destroy(err)
  })

  archive.pipe(pass)

  // Append JSON data, photos, manifest — then finalize
  // archive.append(jsonString, { name: 'data/users.json' })
  // archive.append(photoStream, { name: `photos/${storageKey}` })
  archive.finalize()

  return new Response(Readable.toWeb(pass) as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="snackspot-export.zip"',
    },
  })
}
```

**Critical:** Must include `export const runtime = 'nodejs'` — the Edge runtime does not support Node.js streams. The web app variant route also uses this directive.

### Pattern 2: PostGIS Geography Serialization

**What:** PostGIS `geography(Point, 4326)` is `Unsupported` in Prisma — cannot be read via `findMany`. Use `$queryRaw` with `ST_Y`/`ST_X` to extract lat/lng.

**When to use:** Any query that needs to read the `location` column from `places`.

**Confirmed pattern from `apps/web/app/api/v1/places/[id]/route.ts` (lines 33–58):**

```typescript
// Source: apps/web/app/api/v1/places/[id]/route.ts (verified existing pattern)
const places = await db.$queryRaw<Array<{
  id: string
  name: string
  address: string
  lat: number
  lng: number
  created_at: Date
  updated_at: Date
}>>`
  SELECT
    p.id,
    p.name,
    p.address,
    ST_Y(p.location::geometry) AS lat,
    ST_X(p.location::geometry) AS lng,
    p.created_at,
    p.updated_at
  FROM places p
`
// Output: { id, name, address, lat, lng, created_at, updated_at }
// Serialize as: { ...place, location: { lat: place.lat, lng: place.lng } }
```

**Note:** The export must reconstruct a `{ lat, lng }` object to match D-09. The raw query returns `lat` and `lng` as top-level fields — the serializer must nest them.

### Pattern 3: Prisma Decimal Serialization

**What:** `Prisma.Decimal` objects serialize as `{}` in `JSON.stringify`. Must call `Number()` on each.

**Confirmed from `apps/web/lib/review-helpers.ts` (line 72):**

```typescript
// Source: apps/web/lib/review-helpers.ts (established pattern)
rating: Number(item.rating),
ratingTaste: Number(item.ratingTaste),
ratingValue: Number(item.ratingValue),
ratingPortion: Number(item.ratingPortion),
ratingService: item.ratingService === null ? null : Number(item.ratingService),
ratingOverall: Number(item.ratingOverall),
```

**Applies to Review model fields:** `rating`, `ratingTaste`, `ratingValue`, `ratingPortion`, `ratingService` (nullable), `ratingOverall`.

### Pattern 4: Admin MinIO Client

**What:** The admin app needs its own MinIO client that reads from the same env vars as the web app.

**Model from `apps/web/lib/minio.ts`:**

```typescript
// Source: apps/web/lib/minio.ts (reference implementation)
import * as Minio from 'minio'
import { env } from './env'

export const minioClient = new Minio.Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
})

export const BUCKET = env.MINIO_BUCKET
```

**For the admin app:** `apps/admin/lib/minio.ts` — same structure but simpler (no public client, no presigned PUT, no `ensureBucket`). Only needs `getObject` for export.

**Required env.ts extension:** Add MINIO_* vars to `apps/admin/lib/env.ts` Zod schema:

```typescript
MINIO_ENDPOINT: z.string().min(1),
MINIO_PORT: z.coerce.number().default(9000),
MINIO_USE_SSL: z.string().transform(v => v === 'true').default('false'),
MINIO_ACCESS_KEY: z.string().min(1),
MINIO_SECRET_KEY: z.string().min(1),
MINIO_BUCKET: z.string().min(1),
```

### Pattern 5: Export Manifest Schema

Per INF-03, must include schema version. Recommended structure (Claude's Discretion):

```typescript
interface ExportManifest {
  schemaVersion: 1                  // increment on breaking changes
  exportedAt: string                // ISO 8601 timestamp
  tables: string[]                  // list of exported table names
  counts: Record<string, number>    // per-table record counts
  photosCount: number               // number of photo files in archive
}
```

### Pattern 6: Auth Guard (unchanged pattern)

All 16 existing admin routes use this exact guard:

```typescript
// Source: apps/admin/app/api/users/route.ts (established pattern)
const auth = requireAdmin(req)
if (auth instanceof Response) return auth
```

### Pattern 7: Photo Streaming from MinIO into Archive

```typescript
// Based on: apps/web/lib/minio.ts getObject pattern
for (const photo of photos) {
  try {
    const stream = await minioClient.getObject(BUCKET, photo.storageKey)
    archive.append(stream, { name: `photos/${photo.storageKey}` })
  } catch {
    // Skip missing photos with a warning (Claude's Discretion)
    // Log and continue — do not abort the export
  }
}
```

**Key insight:** `archive.append()` accepts a Node.js `Readable` stream directly. MinIO's `getObject()` returns a `Readable`. No `await` needed per append — archiver queues them internally. Call `archive.finalize()` after all `append()` calls are scheduled.

### Anti-Patterns to Avoid
- **Buffering all records in memory:** Do not `findMany` all tables and hold in RAM before writing. Write each table's JSON to the archive immediately, then move to the next.
- **`JSON.stringify` on Prisma results directly:** Prisma `Decimal` → `{}`, PostGIS `geography` → throws. Always go through serialization helpers.
- **Using p-limit for concurrency:** ESM-only (confirmed by runtime test). Sequential `for...of` with `await` is appropriate — export is single-admin, not a hot path.
- **Missing `export const runtime = 'nodejs'`:** Without this, Next.js may attempt to run the route on Edge runtime, which does not have `node:stream`. The web app variant proxy sets this; the export route must too.
- **Forgetting `archive.finalize()`:** The ZIP will never close, and the browser download will hang indefinitely.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZIP archive creation | Custom ZIP byte writer | `archiver` v7 | ZIP format has checksums, central directory, Zip64 — edge cases are catastrophic |
| Streaming ZIP to HTTP | Buffer everything then send | archiver `pipe` → `PassThrough` → `Readable.toWeb()` | Multi-GB archives will OOM without streaming |
| PostGIS serialization | Custom WKB parser | `$queryRaw` with `ST_Y`/`ST_X` | PostGIS binary format is complex; raw SQL is the established project pattern |
| Decimal serialization | Custom replacer in JSON.stringify | `Number(decimal)` per field | `JSON.stringify` replacer applied to nested objects is error-prone; explicit conversion per field is the established project pattern |

---

## Common Pitfalls

### Pitfall 1: Prisma Decimal Serializes as `{}`
**What goes wrong:** `JSON.stringify(prismaRecord)` produces `"rating": {}` for all Decimal fields. Import fails validation; data is silently lost.
**Why it happens:** Prisma's `Decimal` type is a class instance — `JSON.stringify` calls its (empty) `toJSON()` method.
**How to avoid:** Explicitly convert every Decimal field with `Number()` before passing to `JSON.stringify`. See Pattern 3 above.
**Warning signs:** Check test output — if rating fields in the JSON are `{}` or `"0"`, the conversion is missing.

### Pitfall 2: PostGIS `location` Field Is `Unsupported` — `findMany` Skips It
**What goes wrong:** `db.place.findMany()` returns records without a `location` field — PostGIS columns are `Unsupported("geography")` in Prisma schema and are excluded from generated types.
**Why it happens:** Prisma cannot generate a TypeScript type for PostGIS geography.
**How to avoid:** Always use `db.$queryRaw` for the `places` table export. See Pattern 2.
**Warning signs:** `places.json` has no `lat`/`lng` fields, or they are `undefined`.

### Pitfall 3: Archive Never Closes (Missing `finalize()`)
**What goes wrong:** The HTTP response body is kept open; the browser download spins forever and never completes.
**Why it happens:** archiver does not know when all appends are done unless `finalize()` is called.
**How to avoid:** Always call `archive.finalize()` after scheduling all `append()` calls. Put it after the photo loop, not inside it.
**Warning signs:** Browser shows the download is in progress but never completes.

### Pitfall 4: `archiver.append()` Called After `finalize()`
**What goes wrong:** archiver throws `"append after finalize"` error; the stream is destroyed mid-ZIP.
**Why it happens:** async photo loops where `finalize()` is called before all `await minioClient.getObject()` calls resolve.
**How to avoid:** Complete the photo loop synchronously (schedule all appends) before calling `finalize()`. If each `getObject` must be awaited, use a sequential `for...of` with `await` inside the loop, then call `finalize()` after the loop exits.

### Pitfall 5: Edge Runtime — `node:stream` Not Available
**What goes wrong:** Route fails at build or runtime with "Cannot use node:stream in Edge runtime".
**Why it happens:** Next.js App Router defaults to Edge runtime for some routes.
**How to avoid:** Add `export const runtime = 'nodejs'` at the top of `apps/admin/app/api/export/route.ts`.

### Pitfall 6: MINIO_* Env Vars Missing from Admin `env.ts`
**What goes wrong:** Admin MinIO client throws at startup; export endpoint 500s with "Invalid environment variables".
**Why it happens:** `apps/admin/lib/env.ts` does not include MINIO_* vars — they're only in the web app's env schema.
**How to avoid:** Extend the admin Zod env schema with all 5 MINIO_* vars before creating `apps/admin/lib/minio.ts`.

### Pitfall 7: Photo `storageKey` Format — Original vs Variant Key
**What goes wrong:** Export includes variant keys (`variants/{photoId}/thumb.webp`) instead of originals, or tries to fetch a key that does not exist in MinIO.
**Why it happens:** The `Photo.storageKey` field stores the original key (just `{photoId}`). Variants are stored separately under `variants/` prefix and are NOT in the Photo table.
**How to avoid:** Fetch `Photo.storageKey` directly — it is already the original key. Do not construct the key yourself. Do not include `variants/` objects (D-11 is locked: originals only).

---

## Code Examples

### Complete Export Route Skeleton
```typescript
// apps/admin/app/api/export/route.ts
// Source: pattern synthesized from apps/web/app/api/v1/photos/variant/route.ts + archiver docs
import { type NextRequest } from 'next/server'
import { PassThrough, Readable } from 'node:stream'
import archiver from 'archiver'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { minioClient, BUCKET } from '@/lib/minio'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof Response) return auth

  const pass = new PassThrough()
  const archive = archiver('zip', { zlib: { level: 6 } })

  archive.on('warning', (err) => {
    if (err.code !== 'ENOENT') pass.destroy(err)
  })
  archive.on('error', (err) => pass.destroy(err))
  archive.pipe(pass)

  // Run export pipeline asynchronously (do not await — response streams immediately)
  buildExport(archive).catch((err) => pass.destroy(err))

  return new Response(Readable.toWeb(pass) as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="snackspot-export-${Date.now()}.zip"`,
    },
  })
}

async function buildExport(archive: archiver.Archiver): Promise<void> {
  // 1. Export each table as data/{table}.json
  // 2. Export photos as photos/{storageKey}
  // 3. Append manifest.json
  // 4. archive.finalize()
}
```

### Table Export Helper Pattern
```typescript
// Serialize one table to the archive — example for Review table
const reviews = await db.review.findMany()
const serialized = reviews.map(r => ({
  ...r,
  rating: Number(r.rating),
  ratingTaste: Number(r.ratingTaste),
  ratingValue: Number(r.ratingValue),
  ratingPortion: Number(r.ratingPortion),
  ratingService: r.ratingService === null ? null : Number(r.ratingService),
  ratingOverall: Number(r.ratingOverall),
}))
archive.append(JSON.stringify(serialized, null, 2), { name: 'data/reviews.json' })
```

### Places Table (PostGIS)
```typescript
// Source: pattern from apps/web/app/api/v1/places/[id]/route.ts
const rawPlaces = await db.$queryRaw<Array<{
  id: string; name: string; address: string
  lat: number; lng: number
  created_at: Date; updated_at: Date
}>>`
  SELECT id, name, address,
    ST_Y(location::geometry) AS lat,
    ST_X(location::geometry) AS lng,
    created_at, updated_at
  FROM places
`
const places = rawPlaces.map(p => ({
  id: p.id, name: p.name, address: p.address,
  location: { lat: p.lat, lng: p.lng },
  createdAt: p.created_at, updatedAt: p.updated_at,
}))
archive.append(JSON.stringify(places, null, 2), { name: 'data/places.json' })
```

### Photo Streaming Loop
```typescript
const photos = await db.photo.findMany({
  select: { id: true, storageKey: true, /* all other fields */ }
})

for (const photo of photos) {
  try {
    const stream = await minioClient.getObject(BUCKET, photo.storageKey)
    archive.append(stream, { name: `photos/${photo.storageKey}` })
  } catch {
    // Skip missing photo — log warning, continue export
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Buffer ZIP in memory (jszip) | Stream via archiver + PassThrough | Standard practice for Node.js | Multi-GB exports become feasible |
| Prisma `Decimal.toNumber()` | `Number(decimal)` | Prisma 4+ | `Number()` works identically, more idiomatic TypeScript |
| Raw `pg` queries for geography | Prisma `$queryRaw` template literals | Prisma 3+ | Type-safe tagged templates, parameterized by default |

**Deprecated/outdated:**
- `archiver` v5/v6: Uses older zip-stream; v7 is current stable.
- `p-limit` v3/v4: Had CJS main entry. v5+ is ESM-only. Do not install any version for this use case — sequential loop is sufficient.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Photo `storageKey` in the DB matches the MinIO object key exactly (no bucket prefix, no path transformation) | Pattern 7 + Photo Streaming Loop | If the key stored in DB differs from the MinIO object key, photo retrieval fails silently |
| A2 | `@types/archiver@7.0.0` covers the full archiver v7.0.1 API including `zlib` options and `append()` overloads | Standard Stack | TypeScript build errors during implementation; can be resolved with `// @ts-ignore` or manual type extensions |
| A3 | The admin app's `minio` package dependency version (8.0.x) will be resolved from the workspace root or can be added directly | Standard Stack | If workspace resolution fails, explicit `minio` dependency needs to be added to `apps/admin/package.json` |

---

## Open Questions

1. **Photo error handling: skip vs fail**
   - What we know: Claude's Discretion for this decision. The export must complete even if some photos are missing from MinIO (orphaned DB records are possible).
   - What's unclear: Whether the export manifest/response should surface a count of skipped photos.
   - Recommendation: Skip with console.error logging (admin app uses `console.error` for errors per existing code at `apps/admin/app/api/marketing-email/route.ts:76`). Include `skippedPhotos: number` in the manifest.

2. **Export content-length header**
   - What we know: ZIP size is not known in advance (streaming). The `variant/route.ts` includes `Content-Length` because the MinIO stat is known upfront.
   - What's unclear: Whether the browser download UI degrades without `Content-Length`.
   - Recommendation: Omit `Content-Length`. Modern browsers handle chunked ZIP downloads without it — progress is shown as bytes received, not percentage.

3. **Large table cursor pagination vs `findMany` all**
   - What we know: EXP-06 requires flat RAM. A single `findMany()` for a large table (100k+ reviews) may spike memory even if the ZIP is streamed.
   - What's unclear: Whether the production dataset is large enough to make this a practical concern right now.
   - Recommendation: Use batched `findMany` with cursor pagination per table (e.g., 1000 records at a time), appending each batch incrementally to the JSON array written to the archive. This keeps RAM flat regardless of dataset size.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | All streaming | ✓ | v20.20.1 | — |
| pnpm | Package install | ✓ | (in environment) | — |
| MinIO (local) | Photo streaming in dev | [ASSUMED] | — | Docker Compose service defined in project |
| PostgreSQL + PostGIS | All DB queries | [ASSUMED] | — | Docker Compose service defined in project |
| archiver npm package | ZIP generation | ✗ (not yet installed) | 7.0.1 available | — (must install) |
| @types/archiver | TypeScript build | ✗ (not yet installed) | 7.0.0 available | — (must install) |

**Missing dependencies with no fallback:**
- `archiver` and `@types/archiver` — must be installed before implementation begins

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireAdmin()` on every request — locks export to ADMIN role only |
| V3 Session Management | no | Session handled by existing auth infrastructure |
| V4 Access Control | yes | `requireAdmin()` enforces ADMIN role check (not just authenticated) |
| V5 Input Validation | no | Export has no request body — GET with no parameters |
| V6 Cryptography | no | No crypto in export pipeline |

### Known Threat Patterns for Export Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated export dump | Information Disclosure | `requireAdmin()` guard — returns 401/403 before any DB access |
| Export contains password hashes | Information Disclosure | User.passwordHash IS included in export (it's not a token table). This is intentional for full backup fidelity — export should only be accessible to ADMIN role |
| Export contains token tables | Information Disclosure | D-07 locked — RefreshToken/PasswordResetToken/EmailVerificationToken excluded |
| Path traversal via photo storageKey | Tampering | Use `photo.storageKey` directly from DB without string construction — never concatenate user input |
| Denial of service via concurrent exports | Availability | Export is behind admin auth; admin population is tiny. No additional rate limiting needed for v1 |

---

## Sources

### Primary (HIGH confidence)
- `apps/web/app/api/v1/photos/variant/route.ts` — `Readable.toWeb()` streaming pattern, `runtime = 'nodejs'` requirement [VERIFIED: read from codebase]
- `apps/web/lib/review-helpers.ts` — `Number(decimal)` Decimal serialization pattern [VERIFIED: read from codebase]
- `apps/web/app/api/v1/places/[id]/route.ts` — `$queryRaw` + `ST_Y`/`ST_X` PostGIS pattern [VERIFIED: read from codebase]
- `apps/admin/lib/auth.ts` — `requireAdmin()` pattern and return type [VERIFIED: read from codebase]
- `apps/admin/lib/env.ts` — Zod env schema structure [VERIFIED: read from codebase]
- `apps/admin/app/dashboard/layout.tsx` — `NAV_ITEMS` array, sidebar structure [VERIFIED: read from codebase]
- `packages/db/prisma/schema.prisma` — All 21 models, Decimal fields, PostGIS column, FK relationships [VERIFIED: read from codebase]
- npm registry — archiver@7.0.1 (CJS, main: index.js), @types/archiver@7.0.0 [VERIFIED: npm view]
- npm registry — p-limit@7.3.0 ESM-only (type: module), v4 also ESM-only [VERIFIED: npm view + runtime test]

### Secondary (MEDIUM confidence)
- archiver npm readme — API surface: `archiver('zip', opts)`, `.pipe()`, `.append(stream, {name})`, `.finalize()`, `.on('error')` [CITED: npm view archiver readme]

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry, existing patterns confirmed in codebase
- Architecture: HIGH — streaming pattern confirmed by existing `variant/route.ts` implementation; archiver is CJS and works in Next.js Node runtime
- Pitfalls: HIGH — Decimal/PostGIS pitfalls confirmed by actual Prisma schema inspection; `runtime = 'nodejs'` confirmed by codebase example

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable stack — archiver, MinIO, Prisma versions unlikely to break within 30 days)
