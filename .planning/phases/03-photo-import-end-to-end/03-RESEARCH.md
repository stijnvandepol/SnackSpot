# Phase 3: Photo Import + End-to-End - Research

**Researched:** 2026-04-06
**Domain:** MinIO photo upload from ZIP archive, import summary extension, round-trip validation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Photo upload happens AFTER the database transaction completes — not inside it. DB records (with remapped IDs) must exist first.
- **D-02:** Iterate over `photos/` directory entries in the ZIP, match each to a photo record's storageKey, upload via `minioClient.putObject()`.
- **D-03:** Photos already existing in MinIO (checked via `statObject`) are skipped.
- **D-04:** Photo upload failures do NOT abort the import — failures are counted and reported in the summary.
- **D-05:** Each failed photo upload logs storageKey and error reason in the summary's `photos` section.
- **D-06:** Add a `photos` section to `ImportSummary`: `{ uploaded: number, skipped: number, errors: string[] }`.
- **D-07:** UI summary shows photo stats in a fourth colored stat box alongside the three existing ones.
- **D-08:** Build `scripts/validate-round-trip.ts` that runs against Docker services, outputs pass/fail with per-table counts and photo accessibility.
- **D-09:** Script outputs exit code 0 on full match, 1 on any mismatch.
- **D-10:** PostGIS lat/lng compared with 6 decimal place tolerance.
- **D-11:** Photo upload logic added to existing `/api/import` POST handler, after the `$transaction()` block.
- **D-12:** Same parsed `directory` object from `unzipper.Open.buffer()` is reused — no re-parsing.

### Claude's Discretion

- Exact MinIO bucket creation/verification before photo uploads
- Concurrency strategy for photo uploads (sequential vs parallel with p-limit)
- Validation script runner (tsx, vitest, or standalone node)
- Whether to add a "Validate" button to the UI or keep validation as CLI-only

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMP-07 | Photos from the archive are uploaded to the target MinIO instance | MinIO `putObject`/`statObject` API verified; ZIP entry path structure confirmed; integration slot in route.ts identified |
</phase_requirements>

---

## Summary

Phase 3 adds photo import to the already-complete relational import pipeline and validates the full export→import round-trip. The photo import slots into `apps/admin/app/api/import/route.ts` after the database transaction block. The ZIP already contains photo files at `photos/<storageKey>` (confirmed in export route). The admin MinIO client (`apps/admin/lib/minio.ts`) exposes `minioClient` and `BUCKET` that are used directly.

The round-trip validation script is a standalone TypeScript file at `scripts/validate-round-trip.ts`, runnable with `tsx` (already hoisted to workspace root). It uses `pg` for table COUNT queries (no Prisma needed) and `minio` (hoisted) for `statObject` photo accessibility checks.

A gap exists: the `admin` service in `docker-compose.yml` does not pass `MINIO_*` environment variables to the container, even though the admin app's `env.ts` requires them. This affects both the existing export route and the new photo import. The docker-compose admin service must be extended with `<<: *common-env` (or explicit MINIO vars) as part of this phase.

**Primary recommendation:** Extend `route.ts` post-transaction with a sequential `for` loop over `photos/` ZIP entries using `entry.buffer()` + `minioClient.putObject()`; extend `ImportSummary` type; add fourth stat box to the UI; build standalone validation script using `pg` + `minio`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `minio` | 8.0.7 | `putObject`, `statObject`, `bucketExists`, `makeBucket` | Already installed in `apps/admin` — reuse existing client |
| `unzipper` | 0.12.3 | ZIP entry iteration + `entry.buffer()` | Already installed and parsed in import route |
| `pg` | 8.13.0 | Raw SQL COUNT queries in validation script | Available in `packages/db`; add to workspace root devDeps for script |
| `tsx` | 4.19.2 | Run `.ts` validation script at workspace root | Hoisted to workspace root (`node_modules/.bin/tsx`) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `p-limit` | NOT needed | Concurrency control | See discretion note below — sequential upload is sufficient |

**Concurrency discretion:** The export route uses sequential `for` loop for photo streaming (confirmed in source). Import should match this pattern. `p-limit` is not installed in `apps/admin` and p-limit v5+ is ESM-only (potential bundler issues). Use a sequential `for` loop for photo uploads — the upload happens after the response payload is ready to return, so latency is acceptable.

**Version verification:** [VERIFIED: npm registry and local node_modules inspection]
- `minio@8.0.7` installed in `apps/admin/node_modules/minio`
- `unzipper@0.12.3` installed in `apps/admin/node_modules/unzipper`
- `tsx@4.19.2` hoisted at `/home/gebruiker/SnackSpot/node_modules/.bin/tsx`
- `minio` hoisted at `/home/gebruiker/SnackSpot/node_modules/minio` (usable in scripts)

**Installation (for validation script):**
```bash
# Add pg to workspace root devDeps for the validation script
pnpm add -w -D pg @types/pg
```

---

## Architecture Patterns

### Photo ZIP Entry Path Structure

[VERIFIED: export route source code]

Export stores photos at `photos/{storageKey}`:
```typescript
archive.append(stream, { name: `photos/${photo.storageKey}` })
```

`storageKey` format (from worker source):
- Originals: `originals/<userId>/<uuid>.<ext>` (e.g. `originals/user123/abc123.jpg`)
- Variants: `variants/<uuid>/<size>.webp` — NOT exported (variants are regenerated by worker)

ZIP entry path for a photo: `photos/originals/<userId>/<uuid>.<ext>`

Stripping `photos/` prefix recovers the original `storageKey`:
```typescript
const storageKey = entry.path.slice('photos/'.length)
```

### Integration Slot in route.ts

[VERIFIED: route.ts source code]

The transaction result `summary` is currently returned from `db.$transaction(...)` and immediately returned as `Response.json(result)`. Photo upload code inserts between these two points:

```typescript
// After: const result = await db.$transaction(...)
// Before: return Response.json(result)

// Photo upload loop goes here (D-11)
const photoStats = { uploaded: 0, skipped: 0, errors: [] as string[] }
const photoEntries = directory.files.filter(f => f.path.startsWith('photos/') && f.type === 'File')
for (const entry of photoEntries) {
  const storageKey = entry.path.slice('photos/'.length)
  // statObject check, putObject, count
}
result.photos = photoStats
return Response.json(result)
```

### MinIO v8 API — Verified Method Signatures

[VERIFIED: minio 8.0.7 source at `apps/admin/node_modules/minio/dist/main/internal/client.js`]

```typescript
// Check existence — throws if bucket doesn't exist; returns false if object missing
await minioClient.statObject(BUCKET, storageKey)
// Throws error with code indicating not-found if object absent

// Upload — accepts Buffer directly (no stream required)
await minioClient.putObject(BUCKET, storageKey, buffer: Buffer, size?: number, metadata?: object)

// Bucket existence check
const exists: boolean = await minioClient.bucketExists(BUCKET)

// Create bucket
await minioClient.makeBucket(BUCKET, region?: string)
```

**`statObject` error handling:** `statObject` throws when the object does not exist (it does NOT return null). Wrap in try/catch:
```typescript
const exists = await minioClient.statObject(BUCKET, storageKey).then(() => true).catch(() => false)
```

**`putObject` accepts Buffer:** Confirmed in source — if third argument is `Buffer`, the library wraps it in a readable stream internally. No manual stream creation needed.

### unzipper Entry Access Pattern

[VERIFIED: unzipper 0.12.3 source at `lib/Open/directory.js`]

```typescript
// Reuse the already-parsed directory (D-12)
const photoEntries = directory.files.filter(
  f => f.path.startsWith('photos/') && f.type === 'File'
)

for (const entry of photoEntries) {
  const storageKey = entry.path.slice('photos/'.length)
  const buffer = await entry.buffer()  // returns Promise<Buffer>
  await minioClient.putObject(BUCKET, storageKey, buffer, buffer.length)
}
```

`entry.buffer()` is the standard method used throughout the import route for JSON entries (confirmed in lines 39 and 80 of route.ts).

### ImportSummary Type Extension

[VERIFIED: apps/admin/app/api/import/types.ts source]

Current `ImportSummary` does not have a `photos` field. Add:

```typescript
export interface PhotoImportStats {
  uploaded: number
  skipped: number
  errors: string[]
}

export interface ImportSummary {
  // ... existing fields unchanged ...
  photos?: PhotoImportStats  // optional: absent on hard transaction failure
}
```

Making `photos` optional ensures backward compatibility with the error path (where the transaction fails and no photo upload occurs).

### UI Extension — Fourth Stat Box

[VERIFIED: apps/admin/app/dashboard/export/page.tsx source]

Current grid is `grid-cols-3`. Extend to `grid-cols-4` when `importResult.photos` is present, or add a conditional fourth box:

```tsx
{importResult.photos && (
  <div className="bg-purple-50 rounded-lg p-3 text-center">
    <p className="text-2xl font-bold text-purple-700">{importResult.photos.uploaded}</p>
    <p className="text-sm text-purple-600">Foto&apos;s</p>
  </div>
)}
```

The three existing stat boxes use green (imported), yellow (skipped), blue (tabellen). Purple is the natural next color in this Tailwind sequence.

### Validation Script Architecture

[VERIFIED: workspace structure, tsx at root, minio at root, existing seed.mjs pattern]

Location: `scripts/validate-round-trip.ts` (workspace root — create `scripts/` directory)

Runner: `pnpm tsx scripts/validate-round-trip.ts`

Add to root `package.json` scripts:
```json
"validate": "tsx scripts/validate-round-trip.ts"
```

Script structure:
```typescript
import * as Minio from 'minio'
import { Client } from 'pg'

// Config from env vars (DATABASE_URL, MINIO_*)
// 1. Connect to pg
// 2. COUNT(*) for each of 18 tables
// 3. SELECT id, storage_key FROM photos
// 4. statObject each storageKey in MinIO
// 5. Print pass/fail report
// 6. process.exit(0) or process.exit(1)
```

**Dependencies for script:**
- `minio` — already hoisted to workspace root (`/home/gebruiker/SnackSpot/node_modules/minio`) [VERIFIED]
- `pg` — NOT at workspace root; add as `devDependency` to root `package.json`
- `tsx` — already hoisted to workspace root [VERIFIED]
- No `@prisma/client` needed — raw SQL COUNT queries are simpler and have no generation dependency

### Docker-Compose Gap — Admin Service Missing MINIO_* Vars

[VERIFIED: docker-compose.yml lines for admin service vs x-common-env anchor]

**Critical gap:** `web` and `worker` services use `<<: *common-env` (which includes MINIO_*). The `admin` service does NOT use `x-common-env` and lists no MINIO_* vars in its environment section.

`apps/admin/lib/env.ts` requires `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` at runtime.

**Fix required:** Add `<<: *common-env` to the admin service environment block in `docker-compose.yml`. Without this, the admin container cannot connect to MinIO and both the existing export route and the new photo import route will fail.

```yaml
# In docker-compose.yml admin service environment:
environment:
  <<: *common-env          # ADD THIS
  DATABASE_URL: ${DATABASE_POOL_URL:-...}
  REDIS_URL: ...
  # ... other admin-specific vars
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Object existence check | Manual HEAD request to MinIO | `minioClient.statObject()` | Already in admin's minio client; handles all auth/error cases |
| Object upload | Manual S3 PUT request | `minioClient.putObject()` | Buffer overload handles multipart automatically |
| ZIP entry reading | Manual byte parsing | `entry.buffer()` from unzipper | Already used in route.ts for JSON entries |
| Concurrency limiting | Custom semaphore | Sequential `for` loop | Simpler, no new dependency, matches export pattern |

---

## Common Pitfalls

### Pitfall 1: statObject Throws, Not Returns Null
**What goes wrong:** `await minioClient.statObject(BUCKET, key)` throws an error when object is absent. Checking the return value (null/undefined) misses the case.
**Why it happens:** MinIO SDK v8 uses exceptions for missing objects, not nullable return.
**How to avoid:** Wrap in `.then(() => true).catch(() => false)` pattern.
**Warning signs:** Uncaught promise rejection with MinIO not-found error crashes the upload loop.

### Pitfall 2: Photo Entry Path Has Nested Slashes
**What goes wrong:** `storageKey = "originals/user123/abc.jpg"` → ZIP entry = `"photos/originals/user123/abc.jpg"`. Simple `.replace('photos/', '')` only removes first occurrence if storageKey starts with `photos/`.
**Why it happens:** `storageKey` itself can contain slashes.
**How to avoid:** Use `entry.path.slice('photos/'.length)` (fixed-length prefix removal, not replace).
**Warning signs:** MinIO key becomes `photos/originals/...` with double prefix.

### Pitfall 3: ZIP Directory Entries Mixed With File Entries
**What goes wrong:** Iterating `directory.files` filtered by path prefix includes directory entries (e.g. `photos/` itself, `photos/originals/`) which have no buffer content.
**Why it happens:** unzipper includes directory entries in the file list.
**How to avoid:** Filter `f.type === 'File'` alongside the path prefix filter.
**Warning signs:** `entry.buffer()` on a directory entry throws or returns empty buffer.

### Pitfall 4: Admin Container Missing MINIO Env Vars
**What goes wrong:** Admin app starts but crashes on first MinIO operation (export or import) with env validation error.
**Why it happens:** `docker-compose.yml` admin service doesn't use `<<: *common-env` unlike web/worker.
**How to avoid:** Add `<<: *common-env` to admin service environment in docker-compose.yml as part of this phase.
**Warning signs:** Zod validation error on startup: `Invalid environment variables (MINIO_ENDPOINT, ...)`.

### Pitfall 5: Photo Upload After Response Already Sent
**What goes wrong:** If photo upload code is placed after `return Response.json(result)`, it never runs.
**Why it happens:** `return` exits the function.
**How to avoid:** Accumulate photo stats into `result` before the return statement. The route must wait for all uploads to complete before returning.
**Warning signs:** `photos` field is always absent from response even when photos exist in archive.

### Pitfall 6: Validation Script Can't Resolve Imports
**What goes wrong:** `tsx scripts/validate-round-trip.ts` fails with module-not-found for `pg` or `minio`.
**Why it happens:** `pg` is not hoisted to workspace root; `minio` is hoisted but not in root `package.json`.
**How to avoid:** Add `pg` and `@types/pg` as devDependencies to root `package.json`. `minio` is already hoisted and usable.
**Warning signs:** `Cannot find module 'pg'` error at script startup.

### Pitfall 7: Float Comparison for PostGIS Round-Trip
**What goes wrong:** Export serializes lat/lng as floating-point numbers. Import reconstructs via `ST_MakePoint`. Round-trip comparison fails due to floating-point precision differences.
**Why it happens:** JSON serialization and PostGIS binary storage use different precision.
**How to avoid:** Compare with tolerance of 6 decimal places in validation script (D-10): `Math.abs(a - b) < 0.000001`.
**Warning signs:** Validation reports lat/lng mismatch on every place even after successful round-trip.

---

## Code Examples

### Photo Upload Loop (post-transaction)

```typescript
// Source: verified design based on route.ts pattern + minio v8 API
const photoStats: PhotoImportStats = { uploaded: 0, skipped: 0, errors: [] }

const photoEntries = directory.files.filter(
  f => f.path.startsWith('photos/') && f.type === 'File'
)

for (const entry of photoEntries) {
  const storageKey = entry.path.slice('photos/'.length)
  try {
    // D-03: skip if already exists
    const alreadyExists = await minioClient
      .statObject(BUCKET, storageKey)
      .then(() => true)
      .catch(() => false)

    if (alreadyExists) {
      photoStats.skipped++
      continue
    }

    const buffer = await entry.buffer()
    await minioClient.putObject(BUCKET, storageKey, buffer, buffer.length)
    photoStats.uploaded++
  } catch (err) {
    // D-04: upload failure does not abort import
    const reason = err instanceof Error ? err.message : String(err)
    photoStats.errors.push(`${storageKey}: ${reason}`)
  }
}
```

### Bucket Verification (discretion item)

```typescript
// Source: minio v8 API verified in local node_modules
const bucketExists = await minioClient.bucketExists(BUCKET)
if (!bucketExists) {
  await minioClient.makeBucket(BUCKET)
}
```

### ImportSummary Extension

```typescript
// Source: types.ts pattern
export interface PhotoImportStats {
  uploaded: number
  skipped: number
  errors: string[]
}

export interface ImportSummary {
  success: boolean
  schemaVersion: number
  exportedAt: string
  tablesProcessed: number
  totalImported: number
  totalSkipped: number
  tables: Record<string, ImportTableStats>
  photos?: PhotoImportStats   // absent on hard transaction failure
  error?: string
}
```

### Validation Script Skeleton

```typescript
#!/usr/bin/env tsx
// scripts/validate-round-trip.ts
import * as Minio from 'minio'
import { Client } from 'pg'

const TABLE_NAMES = [
  'users', 'places', 'reviews', 'photos', 'review_photos',
  'comments', 'badges', 'user_badges', 'review_likes', 'favorites',
  'reports', 'moderation_actions', 'notifications',
  'notification_preferences', 'review_mentions', 'review_tags',
  'blocked_words', 'flagged_comments',
]

async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL })
  const minio = new Minio.Client({ /* from env */ })

  await pg.connect()

  let passed = true

  // Table counts
  for (const table of TABLE_NAMES) {
    const { rows } = await pg.query(`SELECT COUNT(*)::int AS n FROM ${table}`)
    console.log(`${table}: ${rows[0].n} records`)
  }

  // Photo accessibility
  const { rows: photos } = await pg.query('SELECT storage_key FROM photos')
  let accessible = 0, missing = 0
  for (const { storage_key } of photos) {
    const ok = await minio.statObject(process.env.MINIO_BUCKET!, storage_key)
      .then(() => true).catch(() => false)
    if (ok) accessible++; else { missing++; passed = false }
  }
  console.log(`Photos: ${accessible} accessible, ${missing} missing`)

  // PostGIS tolerance check (D-10) — compare against a reference snapshot if provided

  await pg.end()
  process.exit(passed ? 0 : 1)
}

main().catch(err => { console.error(err); process.exit(1) })
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@types/minio` separate package | minio v7.1.0+ ships built-in types | minio 7.1.0 | No `@types/minio` needed |
| `putObject` stream-only | `putObject` accepts Buffer directly | minio v8 | Simpler upload — no `Readable.from()` needed |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Adding `<<: *common-env` to admin docker-compose is sufficient to pass MINIO_* vars | Architecture Patterns | If there's a reason MINIO was excluded from admin, adding it may need env file changes too |
| A2 | `entry.type === 'File'` reliably filters directory entries in unzipper 0.12.3 | Architecture Patterns | Directory entries might slip through; could use `entry.uncompressedSize > 0` as fallback |
| A3 | Sequential photo upload (no p-limit) is acceptable for import latency | Standard Stack | For archives with thousands of photos, sequential upload may be slow |

---

## Open Questions

1. **Variant photo files**
   - What we know: Export only exports `photo.storageKey` (the original, e.g. `originals/<uid>/<uuid>.jpg`). The `variants` field in the Photo model stores keys like `{ thumb: "variants/uuid/thumb.webp", ... }` — but these files are NOT exported.
   - What's unclear: After import, photo records have a `variants` JSON field pointing to variant keys that don't exist in the target MinIO. The web app uses variant URLs for display.
   - Recommendation: This is a known limitation of the export design. The worker would need to reprocess imported photos to regenerate variants. This is out of scope for Phase 3 (IMP-07 only requires original photo upload). Document in validation script output that variant regeneration is required post-import.

2. **Round-trip comparison mode**
   - What we know: D-08 says the script runs against "instance A and instance B (same instance with cleared data works too)".
   - What's unclear: Whether the script needs a "before snapshot" file or just reports current counts.
   - Recommendation: Build the script to take an optional `--snapshot` flag. Without it, print current counts for human review. With `--snapshot <file>`, compare against snapshot JSON. This satisfies D-09 without requiring two live instances.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Round-trip validation | ✓ | 29.3.0 | — |
| Docker Compose | Stack startup for validation | ✓ | v5.1.0 | — |
| tsx | Validation script runner | ✓ (hoisted) | 4.19.2 | — |
| minio npm | Photo upload + validation | ✓ (hoisted + admin) | 8.0.7 | — |
| pg npm | Validation script DB queries | ✗ at workspace root | — | Add as workspace devDep |
| PostgreSQL (local) | Direct DB connection | ✗ (Docker only) | — | Use Docker: `docker compose up db` |
| MinIO (local) | Photo upload | ✗ (Docker only) | — | Use Docker: `docker compose up minio` |

**Missing dependencies with no fallback:**
- None that block implementation.

**Missing dependencies with fallback:**
- `pg` at workspace root: add `pnpm add -w -D pg @types/pg` — needed only for validation script.
- PostgreSQL and MinIO not running locally: validation test requires Docker stack (`docker compose up db minio`).

---

## Security Domain

Phase 3 extends an existing admin-only API route. All security controls are already in place:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireAdmin()` already on import route — no change needed |
| V4 Access Control | yes | `requireAdmin()` middleware on all admin API routes |
| V5 Input Validation | yes | ZIP and photo buffer come from already-validated archive |
| V6 Cryptography | no | No new crypto operations |

**No new security surface introduced.** Photo upload uses the existing admin MinIO client and the import route's existing auth guard. The validation script is a local dev/ops tool — not an HTTP endpoint.

---

## Sources

### Primary (HIGH confidence)
- `apps/admin/app/api/import/route.ts` — Full import pipeline source, integration slot identified
- `apps/admin/app/api/import/types.ts` — ImportSummary and IdMaps types
- `apps/admin/app/api/export/route.ts` — ZIP photo entry format (`photos/{storageKey}`)
- `apps/admin/lib/minio.ts` — MinIO client exports
- `apps/admin/app/dashboard/export/page.tsx` — Current UI stat boxes (3-column grid)
- `apps/admin/node_modules/minio/dist/main/internal/client.js` — `putObject`, `statObject`, `bucketExists` signatures
- `apps/admin/node_modules/unzipper/lib/Open/directory.js` — `entry.buffer()` and `entry.type` fields
- `docker-compose.yml` — Admin service env gap confirmed
- `/home/gebruiker/SnackSpot/node_modules/.bin/tsx` — tsx hoisted at workspace root [VERIFIED: exists]
- `/home/gebruiker/SnackSpot/node_modules/minio` — minio hoisted at workspace root [VERIFIED: exists]
- `packages/db/scripts/seed.mjs` — Standalone script pattern using pg

### Secondary (MEDIUM confidence)
- `apps/worker/src/index.ts` — storageKey path format (`originals/<uid>/<uuid>.<ext>`, variants)
- `apps/admin/lib/env.ts` — MINIO_* env vars required at runtime

---

## Metadata

**Confidence breakdown:**
- Photo upload integration: HIGH — source code fully read, slot identified, minio API verified
- Type extension: HIGH — existing types.ts fully read
- UI extension: HIGH — page.tsx fully read, Tailwind color pattern clear
- Validation script: HIGH — tsx/minio/pg availability verified; pg missing at workspace root noted
- Docker-compose gap: HIGH — confirmed by source inspection

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable stack, 30-day horizon)
