# Technology Stack: Export/Import Feature

**Project:** SnackSpot Admin — Export/Import Milestone
**Researched:** 2026-04-06
**Scope:** Libraries and configuration needed to add ZIP-based export/import to an existing Next.js 15 + Prisma 5 + PostgreSQL/PostGIS + MinIO stack

---

## Recommended Stack

### ZIP Creation (Export)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `archiver` | ^7.0.1 | Streaming ZIP generation | Node.js Stream API native, pipes directly to HTTP response without buffering to disk, supports appending streams/buffers/globs. 14M+ weekly downloads, 6,300+ dependents. Appropriate for multi-GB archives. |

**Confidence: HIGH** — verified against npm registry and official GitHub (archiverjs/node-archiver). Version 7.0.1 released March 2024, actively maintained with 72 releases.

**Why not the alternatives:**
- `adm-zip` — loads entire ZIP into memory; dangerous at multi-GB scale; docs explicitly warn against files over 50 MB.
- `jszip` — no native streaming for writing; designed for browser-side use.
- `yazl` — lower-level and streaming-capable, but lacks the high-level pipe/glob API that makes `archiver` simpler to use. Justified only if `archiver` overhead becomes a measured bottleneck.

### ZIP Extraction (Import)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `unzipper` | ^0.12.x | Streaming ZIP extraction | Active fork of the unmaintained `node-unzip`; fixes event completion bugs; streaming-first so individual entries can be piped without extracting the entire archive to disk first. 3.4M weekly downloads, positive release cadence in 2025. |

**Confidence: MEDIUM** — confirmed active maintenance and streaming architecture via npm advisory data. Version cadence verified via Snyk health report (last updated Jan 2025).

**Why not the alternatives:**
- `yauzl` — requires a complete ZIP file on disk (reads from the end per ZIP spec). Valid for small, already-on-disk archives; wrong pattern here where the upload is still streaming in.
- `extract-zip` — built on yauzl; same disk-first constraint.
- `adm-zip` — in-memory; ruled out for the same reason as on the export side.

### Multipart Upload Parsing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@fastify/busboy` | ^3.x | Parse multipart/form-data in Next.js Route Handler | The original `busboy` (by mscdex) has not been updated in 3+ years. The `@fastify/busboy` fork is the actively maintained, battle-tested replacement. Streaming-first: emits a Readable per file entry, never buffers to temp disk. Already indirectly in the ecosystem via multer/many other tools. |

**Confidence: MEDIUM** — activity confirmed via npm and GitHub. The fork separation is well-documented in community discussions.

**Why not the alternatives:**
- `formidable` — writes to temp disk by default; adds cleanup complexity.
- `multer` — Express-specific middleware; doesn't integrate cleanly with Next.js App Router Route Handlers without a compatibility shim.
- `next-multiparty` — thin wrapper around formidable; adds a dependency for no benefit here.

**Next.js body-parser configuration required:**

Export endpoint (streaming response, no upload):
```typescript
// No special config needed — Route Handlers stream by default in App Router
export async function GET(req: Request) {
  // Return a ReadableStream piped from archiver
}
```

Import endpoint (large file upload):
```typescript
// next.config.mjs — raise proxy body limit for the import route
const nextConfig = {
  experimental: {
    // Raise from default 10 MB to handle multi-GB ZIPs
    // Only affects the Next.js proxy layer; busboy processes the raw stream
  },
}
```

For the import route, disable Next.js body parsing and hand the raw `Request` body to busboy directly. In the App Router, `req.body` is a native `ReadableStream`; convert it with `Readable.fromWeb()` from `node:stream`. This avoids any size limit imposed by the built-in body parser.

### PostGIS Geography Serialization

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Raw SQL via `prisma.$queryRaw` | (built-in) | Serialize/deserialize `geography(Point,4326)` | Prisma maps the `location` column to `Unsupported("geography(Point, 4326)")` — the ORM cannot read or write it. Raw SQL is the only supported path. |

**Export pattern** — read as GeoJSON using PostGIS built-in function:
```sql
SELECT id, name, address,
  ST_AsGeoJSON(location)::json AS location,
  created_at, updated_at
FROM places
```

**Import pattern** — write from GeoJSON coordinate pair:
```sql
INSERT INTO places (id, name, address, location, created_at, updated_at)
VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7)
```

Storing `{ type: "Point", coordinates: [lng, lat] }` in the export JSON is human-readable and round-trips cleanly through PostGIS. No additional library needed.

**Confidence: HIGH** — `ST_AsGeoJSON` and `ST_MakePoint` are stable PostGIS 3.x functions. Prisma `$queryRaw` with tagged template literals (SQL injection safe) is the documented workaround for unsupported types.

**Why not `wkx`:**
`wkx` (version 0.5.0, last published 2020, no updates since 2022) handles WKB/EWKB format which is what Postgres returns by default for geometry columns. Using `ST_AsGeoJSON` in the query bypasses the need entirely and produces a directly JSON-serializable value. Adding a stale dependency to decode what Postgres can decode natively is unnecessary.

### JSON Schema Validation (Import)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `zod` | ^3.23.8 (already installed) | Validate JSON payload from ZIP before any DB writes | Already in `apps/admin/package.json`. No new dependency. Provides `.safeParse()` for non-throwing validation, strong TypeScript inference, and composable schemas for nested objects. 40M+ weekly downloads as of early 2026. |

**Confidence: HIGH** — current dependency, confirmed dominant in the ecosystem.

**Pattern:** Define one Zod schema per exported table shape. Run `.safeParse()` on each row before DB insert. Collect `ZodError.flatten()` results into the import summary report instead of aborting the entire import.

### Concurrency Control for Batch Operations

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `p-limit` | ^6.x | Limit concurrent MinIO uploads and DB batch calls during import | Pure ESM, tiny (no dependencies), 101M weekly downloads. Prevents OOM and connection pool exhaustion when uploading hundreds of photos or inserting thousands of rows concurrently. |

**Confidence: HIGH** — version 6.x confirmed as current stable (v7.3.0 also exists as of Feb 2026; check latest before pinning). Project is by sindresorhus, actively maintained.

**Note on ESM:** `p-limit` v5+ is pure ESM. The monorepo uses TypeScript compiled by `tsc`/`tsx` with `"module": "ESNext"` or `"NodeNext"`. Verify `tsconfig.json` module resolution before installing; if the admin app uses CommonJS output, pin to `p-limit@4` which supports CJS.

**Recommended concurrency values:**
- MinIO photo uploads: `pLimit(5)` — avoids saturating MinIO's connection pool.
- Prisma batch inserts: use `createMany` with chunking (see below); no need for p-limit there.

### Batch Database Inserts

No new library needed. Use Prisma's built-in:

```typescript
await db.user.createMany({
  data: validatedRows,
  skipDuplicates: true,  // PostgreSQL only — silently ignores unique-constraint violations
})
```

`skipDuplicates: true` is PostgreSQL-supported (confirmed in Prisma docs). For the duplicate-detection requirement (email for users, name+address for places), use `createMany` with `skipDuplicates` as the primary mechanism, then query back to build an old-ID → new-ID remap table for FK resolution.

For tables with compound primary keys (`ReviewLike`, `Favorite`, `ReviewTag`), `createMany` + `skipDuplicates` works correctly — Prisma generates `ON CONFLICT DO NOTHING`.

**Confidence: HIGH** — Prisma docs confirm `skipDuplicates` support for PostgreSQL.

### MinIO Photo Transfer

No new library needed. The existing `minio` ^8.0.3 client (already in `apps/worker`) must be added to `apps/admin`. Use:

- `minioClient.getObject(bucket, key)` → returns a `Readable` stream — pipe directly into archiver during export.
- `minioClient.putObject(bucket, key, stream, size?, contentType?)` — accepts a `Readable` stream — pipe directly from the unzipper entry during import.

Both operations are fully streaming; no temp files on the Node.js server.

**Confidence: HIGH** — MinIO JS SDK v8 streaming API verified against official MinIO documentation.

---

## Installation

Add to `apps/admin/package.json`:

```bash
pnpm --filter @snackspot/admin add archiver unzipper @fastify/busboy p-limit minio
pnpm --filter @snackspot/admin add -D @types/archiver @types/unzipper
```

Notes:
- `zod` is already installed in `apps/admin`.
- `minio` is already in `apps/worker`; add it to `apps/admin` as well — no version conflict risk since both will resolve the same workspace version.
- `@types/archiver` is on DefinitelyTyped; verify it covers v7 before installing (types for v7 may lag). If missing, add a minimal `declare module 'archiver'` shim.
- `p-limit` ships its own TypeScript declarations — no `@types` package needed.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| ZIP creation | `archiver` | `yazl` | Lower-level API; no meaningful benefit over archiver for this use case |
| ZIP creation | `archiver` | `jszip` | No streaming write support; designed for browser |
| ZIP creation | `archiver` | `adm-zip` | In-memory; fails at multi-GB |
| ZIP extraction | `unzipper` | `yauzl` | Requires complete file on disk before reading |
| ZIP extraction | `unzipper` | `extract-zip` | Same disk-first constraint as yauzl |
| Multipart | `@fastify/busboy` | `formidable` | Writes to disk by default; unnecessary I/O |
| Multipart | `@fastify/busboy` | `multer` | Express-specific, awkward in App Router |
| Geography | Raw SQL + ST_AsGeoJSON | `wkx` | Stale (2020), solves a problem PostGIS already solves natively |
| Concurrency | `p-limit` | `p-queue` | Overkill; priority queuing not needed here |
| Batch insert | `createMany` + `skipDuplicates` | Row-by-row `upsert` | N+1 round-trips; 10-100x slower on large datasets |

---

## Configuration Decisions

### Export: Streaming HTTP Response

Archiver pipes to a `PassThrough` stream; the Route Handler returns a `ReadableStream` constructed from the Node.js stream. No temporary file is created on the server. The HTTP response streams the ZIP to the browser as it is built.

### Import: Stream-through Processing

The upload multipart stream feeds directly into unzipper. Each ZIP entry is processed inline:
- `.json` entries: buffered (they are metadata, bounded in size), parsed, validated via Zod, then inserted via Prisma.
- Binary entries (photos): piped directly to MinIO `putObject` without buffering.

This means a 5 GB archive with 10,000 photos never fully lands on the Next.js server's disk.

### ID Remapping Strategy

Build a Map of `oldId → newId` per table as rows are inserted (for tables that get new IDs on insert — i.e., records skipped via `skipDuplicates` keep their old IDs, while truly new records use the exported ID directly if it doesn't conflict). The import order must follow FK dependency order:

```
Users → Badges → Places
  → Reviews → Comments → ReviewPhotos → ReviewLikes
  → Favorites → ReviewTags → ReviewMentions
  → Reports → ModerationActions → Notifications
  → UserBadges → NotificationPreferences
  → RefreshTokens (skip — session data, not portable)
  → PasswordResetTokens (skip — expired on export)
  → EmailVerificationTokens (skip — expired on export)
```

Session/token tables (`refresh_tokens`, `password_reset_tokens`, `email_verification_tokens`) should be explicitly excluded from export — they are ephemeral and meaningless across instances.

---

## Sources

- archiver npm/GitHub: https://github.com/archiverjs/node-archiver (v7.0.1, March 2024)
- unzipper Snyk health: https://snyk.io/advisor/npm-package/unzipper (Jan 2025)
- @fastify/busboy: https://github.com/fastify/busboy
- Prisma createMany skipDuplicates: https://www.prisma.io/docs/orm/prisma-client/queries/crud
- Prisma PostGIS raw SQL: https://freddydumont.com/blog/prisma-postgis
- PostGIS ST_AsGeoJSON: https://postgis.net/docs/ST_AsGeoJSON.html
- Prisma PostGIS issue (native support still pending): https://github.com/prisma/prisma/issues/25768
- p-limit GitHub: https://github.com/sindresorhus/p-limit
- MinIO JS SDK streaming: https://docs.min.io/enterprise/aistor-object-store/developers/sdk/javascript/api/
- archiver vs adm-zip vs jszip 2026 comparison: https://www.pkgpulse.com/blog/archiver-vs-adm-zip-vs-jszip-zip-archive-creation-2026
- Next.js body size limits: https://nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize
