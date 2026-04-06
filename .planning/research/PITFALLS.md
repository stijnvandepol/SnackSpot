# Pitfalls Research

**Domain:** Data export/import system — PostgreSQL + PostGIS, Prisma ORM, MinIO file storage, relational data with 15+ tables
**Researched:** 2026-04-06
**Confidence:** HIGH (schema inspected directly, verified against official sources)

---

## Critical Pitfalls

### Pitfall 1: PostGIS Geography Columns Are Invisible to Prisma — Silent Data Loss on Export

**What goes wrong:**
`Place.location` is declared as `Unsupported("geography(Point, 4326)")` in the Prisma schema. When you run `prisma.place.findMany()`, Prisma silently omits the `location` field from the result — it is not returned, no error is thrown. An export built on Prisma's standard query API will produce Place records with no location data. When those records are re-imported, Places are created with a null geometry column, violating the NOT NULL constraint or storing a null coordinate silently depending on the DB schema.

**Why it happens:**
Prisma marks `Unsupported` fields as non-queryable in generated TypeScript types. Developers see the field in the schema but assume Prisma returns it; the type system hides that it is absent from query results.

**How to avoid:**
Export Place rows using `prisma.$queryRaw` with an explicit `ST_AsGeoJSON(location)` projection so the geography is serialized as a GeoJSON string. During import, reconstruct it using `ST_GeomFromGeoJSON($1)` in a raw INSERT. Never rely on Prisma's standard findMany for tables containing `Unsupported` columns when those columns must be preserved.

Example export query:
```sql
SELECT id, name, address,
       ST_AsGeoJSON(location)::text AS location_geojson,
       created_at, updated_at
FROM places
```

Example import insertion:
```sql
INSERT INTO places (id, name, address, location, created_at, updated_at)
VALUES ($1, $2, $3, ST_GeomFromGeoJSON($4), $5, $6)
```

**Warning signs:**
- Places export successfully but have no lat/lng when re-imported
- Import succeeds with zero constraint errors yet map shows no pins
- TypeScript types for the exported Place object lack a `location` property

**Phase to address:** Export phase (data serialization). Must be resolved before any export integration test can pass.

---

### Pitfall 2: Decimal Ratings Cannot Be JSON.stringify'd Without Precision Loss or Runtime Errors

**What goes wrong:**
Prisma returns `rating`, `ratingTaste`, `ratingValue`, `ratingPortion`, `ratingService`, `ratingOverall` as `Prisma.Decimal` objects (instances of `Decimal.js`). Calling `JSON.stringify()` on a raw Prisma query result containing these fields either throws a runtime error (`[object Decimal] cannot be serialized as JSON`) or silently drops precision depending on version and serializer. A rating of `4.5` may round-trip as `4` or `"4.5000000000000000"` (18 decimal places) depending on how serialization is handled, corrupting data or causing import validation failures.

**Why it happens:**
JavaScript's native number type cannot represent all decimal fractions exactly. Prisma uses Decimal.js to avoid precision loss in the ORM layer, but this type is not JSON-serializable by default. Developers often discover this only when the Next.js API route tries to send the data to the client.

**How to avoid:**
Serialize Decimal fields explicitly as strings (`.toString()`) when writing to the export JSON. During import, parse them back to strings and use Prisma's `new Prisma.Decimal(value)` constructor, or pass them as string literals in raw SQL. Never coerce to `Number` — a `Decimal(2,1)` field like `4.5` is safe, but the conversion path `Decimal -> Number -> JSON -> string` can still produce `"4.5"` with trailing zeros that break equality checks.

Recommended helper:
```typescript
function serializeDecimal(d: Prisma.Decimal | null): string | null {
  return d === null ? null : d.toString()
}
```

**Warning signs:**
- Export route throws `TypeError: Do not know how to serialize a BigInt` or similar at runtime
- Exported JSON contains `{}` where rating values should appear
- Import validation rejects ratings like `"4.5000000000000000"` due to format mismatch

**Phase to address:** Export phase (serialization layer). Write a shared `serializeRecord()` utility before touching any query result output.

---

### Pitfall 3: Import Order Violations Due to Multi-Level FK Dependency Chain

**What goes wrong:**
The schema has a strict dependency order that is easy to get wrong. `Review` depends on both `User` and `Place`. `Comment` depends on `User` and `Review`. `ReviewPhoto` depends on `Review` and `Photo`. `Photo` depends on `User`. `Notification` depends on `User`, `Review`, and `Comment`. If records are inserted in the wrong order, PostgreSQL's foreign key constraints throw an error and the entire import fails — or worse, if constraints are temporarily disabled, orphaned records are silently created.

Full correct import order for this schema:
1. `Badge` (no dependencies)
2. `User` (no dependencies)
3. `Place` (no dependencies)
4. `RefreshToken`, `EmailVerificationToken`, `PasswordResetToken` (depend on User — but see Pitfall 8)
5. `NotificationPreferences` (depends on User)
6. `BlockedWord` (depends on User)
7. `Review` (depends on User + Place)
8. `Photo` (depends on User)
9. `Comment` (depends on User + Review)
10. `ReviewTag` (depends on Review)
11. `ReviewLike` (depends on User + Review)
12. `ReviewPhoto` (depends on Review + Photo)
13. `Favorite` (depends on User + Place)
14. `UserBadge` (depends on User + Badge)
15. `Report` (depends on User + Review + Photo)
16. `ModerationAction` (depends on User)
17. `ReviewMention` (depends on Review + User)
18. `FlaggedComment` (depends on Comment + User)
19. `Notification` (depends on User + Review + Comment)

**Why it happens:**
Developers start with the most visible entities (Place, Review) rather than deriving order from FK graph traversal. Junction tables (ReviewPhoto, ReviewLike) are often imported before their parent tables are complete.

**How to avoid:**
Hardcode the import order in a `IMPORT_ORDER` constant array. Do not dynamically infer order at runtime — the schema is fixed and the order is deterministic. Write a unit test that validates each table in the array appears after all its FK dependencies.

**Warning signs:**
- `ForeignKeyConstraintViolation` during import on any table other than the first
- Review import succeeds but ReviewPhoto import fails with unknown photoId
- Import log shows success for some tables but then aborts mid-sequence

**Phase to address:** Import phase (pre-implementation design). Define and document the order before writing a single insert.

---

### Pitfall 4: ID Remapping on Compound Primary Keys Is Missed

**What goes wrong:**
Five tables use compound primary keys: `ReviewLike (userId, reviewId)`, `Favorite (userId, placeId)`, `ReviewPhoto (reviewId, photoId)`, `UserBadge (userId, badgeId)`, `ReviewTag (reviewId, tag)`. When duplicate detection remaps source IDs to target IDs (e.g., the imported user with email `alice@example.com` already exists with a different `id` in the target), all compound keys referencing that user must be remapped too. A naive implementation remaps scalar FK columns but forgets that the compound key itself is composed of those FK columns — the lookup map must be applied to every FK component before the row is constructed.

**Why it happens:**
ID remapping is typically implemented as a `Map<sourceId, targetId>`. Developers apply it to simple FK fields like `review.userId` but forget that `ReviewLike.userId` is simultaneously both the FK reference and part of the composite PK. Missing one mapping causes either a duplicate key violation (if old ID matches an existing row) or an orphaned row referencing a nonexistent user.

**How to avoid:**
Build the remap lookup before any insert phase. For each table, apply the remap to all FK columns first, then construct the composite key from the already-remapped values. Never use source IDs directly as part of an insert for junction tables. Test by importing a dataset where every user, place, and badge already exists in the target — all junction table rows should still insert correctly with remapped keys.

**Warning signs:**
- `UniqueConstraintViolation` on compound key tables during import
- ReviewLike records inserted with old user ID that exists in source but not target
- Favorite count in target doesn't match source after import

**Phase to address:** Import phase (ID remapping logic). Must be designed holistically, not table-by-table.

---

### Pitfall 5: Streaming ZIP to Next.js Route Handler Blocks the Node.js Process for Multi-GB Archives

**What goes wrong:**
The export endpoint generates a ZIP containing all database JSON plus all MinIO photo files. For large instances this can be several gigabytes. If the ZIP is assembled in memory (e.g., using `JSZip` or `adm-zip`) before sending the response, the Node.js process runs out of heap memory and crashes. Even with a "streaming" library like `archiver`, many implementations inadvertently buffer photo streams in memory because they `await` the full photo download from MinIO before appending it to the archive rather than piping the stream directly.

Specific issue: `archiver` with large numbers of files (500+ files, each 3MB) can hit the 4GB memory limit. The heap crash kills the entire Next.js server process, taking down the admin panel.

**Why it happens:**
The intuitive implementation downloads photos one-by-one with `await minioClient.getObject(...)`, collects them into a buffer array, then builds the archive. This looks like streaming code but is actually fully buffered. The correct approach pipes the MinIO ReadableStream directly to the archiver entry without awaiting the full object.

**How to avoid:**
Use `archiver` with the `zip` format and pipe each MinIO object stream directly into the archive:

```typescript
const minioStream = await minioClient.getObject(bucket, key)
archive.append(minioStream, { name: `photos/${key}` })
// Do NOT: const buf = await streamToBuffer(minioStream); archive.append(buf, ...)
```

Pipe the archive directly to the HTTP response stream. Never collect the full archive into a Buffer before responding.

Additionally: enable `forceZip64: true` on the archiver zip plugin to avoid the 4.29GB ZIP file size limit. Standard ZIP32 cannot create archives larger than ~4GB, and the resulting file is corrupt or unreadable without ZIP64 extension.

**Warning signs:**
- Admin panel goes down when export is triggered on a large dataset
- Node.js process memory climbs to several GB before crashing
- Export works on test data (10 photos) but fails in production (1000+ photos)
- ZIP file is exactly 4.29GB and cannot be opened on any platform

**Phase to address:** Export phase (streaming architecture). Must be validated with a synthetic large dataset before considering the feature complete.

---

### Pitfall 6: ZIP Upload in the Import Route Hits Next.js Body Size Limits

**What goes wrong:**
The import endpoint must receive a multi-GB ZIP file. Next.js App Router Route Handlers do not have the 4MB response size limit (that applies to Pages Router API routes) but the incoming request body parsing still has practical constraints. The default behavior buffers the entire request body before the handler receives it. For a 2GB ZIP, this buffers 2GB into memory simultaneously with the in-progress extraction. If the admin panel is on a small VM (1-2GB RAM), this crashes the server.

Separately: if the developer uses the Pages Router (`pages/api/`) rather than the App Router (`app/api/`), the 4MB body parser limit must be disabled via `export const config = { api: { bodyParser: false } }`. Forgetting this silently truncates the upload.

**Why it happens:**
Next.js 15 admin app uses App Router (`apps/admin`), but developers reading older Next.js documentation or copying from Stack Overflow examples use Pages Router config syntax, which is either silently ignored or throws a deprecation error in App Router.

**How to avoid:**
In the App Router import route, read the request as a stream using `request.body` (a `ReadableStream`) and pipe it through a streaming ZIP extraction library rather than buffering the full body. Use `busboy` or a streaming unzip library (e.g., `unzipper`) that can process entries as they arrive. Write extracted files to a temp directory on disk rather than holding them in memory.

**Warning signs:**
- Import fails for archives over 100MB but works for small test archives
- Node.js memory spikes to full server RAM during upload
- Browser shows network timeout during large archive upload

**Phase to address:** Import phase (upload handler). Design the streaming architecture before implementing any extraction logic.

---

### Pitfall 7: Partial Import Leaves the Database in an Inconsistent State

**What goes wrong:**
Import processes 18 tables in sequence. If the process fails halfway through — say, `Comment` import succeeds but `FlaggedComment` import fails due to a data error — the database is partially imported. Reviews exist but related notifications do not. Repeated import attempts then collide on the already-imported records, producing duplicate key errors that obscure the original failure. The admin is left with a corrupted dataset and no clear way to roll back.

**Why it happens:**
Developers wrap each table's inserts in a transaction but do not wrap the entire import in a single outer transaction. Individual table transactions commit successfully, making the partial state permanent.

**How to avoid:**
Wrap the entire import in a single Prisma interactive transaction (`prisma.$transaction(async (tx) => { ... })`) or use PostgreSQL's `BEGIN / COMMIT / ROLLBACK` via raw connection. If the import of any single table fails, roll back everything. Note that large imports (millions of rows) may hit transaction timeout limits — configure `timeout` on the Prisma transaction call explicitly. For very large datasets, implement a "dry run" mode that validates all data without committing, so failures are detected before any writes occur.

**Warning signs:**
- Re-running an import after a failure produces different errors than the first run
- Some tables have data from the archive but others do not
- Import summary shows success for 12/18 tables then stops

**Phase to address:** Import phase (transaction design). Decide on the rollback strategy before writing any insert logic.

---

### Pitfall 8: Exporting Security-Sensitive Tokens Creates a Credential Exposure Vector

**What goes wrong:**
The schema includes `RefreshToken`, `PasswordResetToken`, and `EmailVerificationToken`. If these are included in the export archive, the ZIP becomes a credential dump. Anyone who obtains the archive (backup storage, transit, admin workstation) can extract password reset token hashes and potentially impersonate users. Importing these tokens into a new instance also makes those tokens valid on the new instance, breaking the security model.

**Why it happens:**
The "export all tables" requirement is interpreted literally. The developer loops over all Prisma models and exports every table without excluding token tables.

**How to avoid:**
Explicitly exclude `RefreshToken`, `PasswordResetToken`, and `EmailVerificationToken` from the export. Document this exclusion in the export manifest so the import side knows not to expect these tables. On import, do not attempt to import them. After import, users will simply need to log in again on the new instance — this is the correct behavior.

Also consider whether `Notification` records (which contain no PII beyond user IDs) and `ModerationAction` records are operationally useful in a migration context. These are low-risk to include but increase archive size.

**Warning signs:**
- Export archive size is much larger than expected (token tables can be large in active instances)
- Security review asks "what's in this archive?"
- Import fails because token tables reference users not yet imported (ordering problem created by including them)

**Phase to address:** Export phase (table selection). Define the exclusion list before implementing the export query loop.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Buffer full ZIP in memory instead of streaming | Simpler implementation, no stream piping complexity | Server OOM crash on large datasets; 4GB ZIP32 limit hit | Never — streaming must be the default for this use case |
| Rely on Prisma findMany for all tables including Place | Uniform code, no raw SQL | Silent loss of PostGIS location data on every Place record | Never — location is core data |
| Serialize Decimal with `.toNumber()` | One-liner conversion | Precision loss on import; potential downstream calculation errors | Never — use `.toString()` |
| Skip outer transaction, commit per-table | Avoids large transaction timeout risk | Partial imports leave inconsistent state with no clean rollback | Only acceptable if a robust dry-run validation phase runs first |
| Include all tables in export (including token tables) | No exclusion logic needed | Security exposure of hashed tokens in archive | Never — always exclude session/token tables |
| Parse entire ZIP into memory on import | Simpler extraction logic | Server OOM on multi-GB archives | Only acceptable for archives under ~100MB; document the limit |
| Use source IDs directly without remapping | No mapping table needed | Duplicate key collisions when target has existing data | Only acceptable if target is always empty (fresh install only) |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| MinIO photo download during export | `await minioClient.getObject()` then buffer to memory | Pipe `ReadableStream` from MinIO directly into archiver entry without buffering |
| MinIO photo upload during import | Upload photos after all DB records are written, causing orphaned Photo records if upload fails | Upload photos before writing `Photo` DB records; only create the DB record once the binary is confirmed in MinIO |
| `archiver` ZIP library | Appending many small files without back-pressure causes memory growth | Use `archive.pipe(response)` early and let back-pressure regulate append rate; check `archive.pointer()` to monitor size |
| Prisma `$queryRaw` with PostGIS | String-interpolating user data into raw SQL queries | Always use tagged template literals (`$queryRaw\`...\``) with parameterized values; never concatenate |
| Prisma `$transaction` for large imports | Default 5-second timeout causes large transactions to abort | Set explicit `timeout` option: `prisma.$transaction(fn, { timeout: 300_000 })` |
| Next.js App Router import handler | Reading `await request.json()` to get the ZIP | Read `request.body` as a `ReadableStream`; ZIP is binary, not JSON |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching all photos from MinIO sequentially (one at a time) | Export takes hours for instances with 5000+ photos | Use a concurrency-limited async queue (e.g., `p-limit` with concurrency 10) to fetch and stream photos in parallel | Around 500 photos; 1000+ photos makes it impractical |
| Running `createMany` for every table in a single Prisma transaction | Transaction size grows unboundedly; Prisma client memory spikes | Batch inserts: chunk rows into groups of 500-1000, each chunk in its own transaction | Around 10,000 rows per table |
| Building the ID remap in memory before imports begin | Peak memory holds all source IDs + all target lookup results simultaneously | Build and apply remap lazily table-by-table; clear completed tables from memory after use | Around 500,000 total rows across all tables |
| Validating ZIP integrity by extracting all files to memory | Import handler OOM crash before any validation completes | Use streaming extraction to validate file-by-file; validate as you extract, not after | Archives over 200MB |
| `prisma.place.findMany()` without raw SQL for export | Location field is missing from all exported Place records — silent failure | Use `$queryRaw` for any table with `Unsupported` column types | First export of any size |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Including token tables in export archive | Attacker with archive access can extract valid-hash tokens usable for password reset or session hijack | Explicitly exclude `refresh_tokens`, `password_reset_tokens`, `email_verification_tokens` from export; document exclusion in manifest |
| Importing archives without authenticating uploader | Malicious archive could insert a user with `ADMIN` role or replace existing admin password hash | Validate all imported records against the Prisma schema types; reject any record with unexpected fields; require `requireAdmin()` middleware on import endpoint |
| Storing export archive in a world-readable MinIO bucket | Archive contains all user emails, password hashes, and content | Store export archives in a private bucket with short-lived presigned download URLs; delete archive after download |
| No size limit on import upload | Attacker sends 100GB archive to exhaust disk space | Enforce a max upload size (e.g., 5GB) via Content-Length header check before beginning extraction |
| Processing import archive without virus/malform check | Maliciously crafted ZIP (zip bomb, path traversal) could exhaust disk or write to unexpected paths | Validate all extracted entry paths — reject any entry with `..` in the path; enforce max extracted size limit |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress indication during export | Admin thinks the export button is broken and clicks it multiple times, queuing multiple concurrent exports | Show spinner immediately on click; disable button during export; display "Preparing archive..." status |
| Silent failure on import with unhelpful error message | Admin re-uploads the same broken archive repeatedly | Show per-table import progress; surface first error with the table name and record identifier that failed |
| Presenting raw Prisma error messages on validation failure | Admin cannot interpret `ForeignKeyConstraintViolation` or `UniqueConstraintViolation` | Translate DB errors to human-readable messages: "Place 'McDonald's, Main St' already exists — skipped" |
| Download starts before archive is complete | Browser receives partial ZIP, which opens as corrupt | Only begin streaming the response when archiver is finalized; use `archive.finalize()` signal |
| No summary after import completes | Admin cannot verify import quality without manually checking counts | Always show import summary: tables processed, rows imported, rows skipped, rows failed, with breakdown per table |

---

## "Looks Done But Isn't" Checklist

- [ ] **PostGIS export:** Verify exported JSON for Place records contains `location_geojson` with valid GeoJSON coordinates — not `null`, not `{}`, not missing
- [ ] **Decimal serialization:** Check exported JSON rating fields are strings (`"4.5"`) not numbers (`4.5`) and that they round-trip exactly through import
- [ ] **Compound key remapping:** Test import where source user already exists in target — `ReviewLike`, `Favorite`, `UserBadge` junction records must use target IDs, not source IDs
- [ ] **Token table exclusion:** Confirm export archive contains no `refresh_tokens.json`, `password_reset_tokens.json`, or `email_verification_tokens.json` files
- [ ] **ZIP64 support:** Verify a synthetic archive over 4.2GB can be created and opened correctly (test on both Linux and macOS)
- [ ] **Photo binary integrity:** MD5/SHA256 checksum a photo before export and after import — confirm bytes are identical
- [ ] **Transaction rollback:** Corrupt one row in a 1000-row import dataset and confirm zero rows are committed to the database on failure
- [ ] **MinIO upload before DB record:** Confirm that if MinIO photo upload fails mid-import, no orphaned `Photo` DB record is left behind
- [ ] **Import idempotency:** Run the same import twice — second run should produce zero new records (all skipped as duplicates), not duplicate key errors
- [ ] **Large archive streaming:** Trigger an export with 2000+ photos and confirm Node.js heap stays below 512MB throughout

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| PostGIS location exported as null | HIGH — all places missing coordinates in target | Re-export from source using corrected raw SQL query; re-import places only (requires partial import support or manual SQL) |
| Decimal precision corrupted | MEDIUM — ratings stored incorrectly | Re-export ratings from source DB as raw SQL; compare against imported values; update mismatched rows with SQL UPDATE |
| Partial import committed without transaction | HIGH — inconsistent state in target DB | Identify highest successfully imported table; manually delete all records from that table and below; re-run full import |
| Token tables included in archive | MEDIUM — security incident response | Revoke all refresh tokens in source instance (`UPDATE refresh_tokens SET used_at = NOW()`); inform users; delete archive from storage immediately |
| ZIP corrupt / truncated | LOW — no data written yet | Regenerate export from source; diagnose whether ZIP32 limit was hit (check if file is exactly 4.29GB) |
| Photos uploaded to MinIO but DB records missing | MEDIUM — orphaned objects in MinIO | Query MinIO for all keys in photos bucket; diff against `storage_key` values in `photos` table; delete orphaned objects or create missing DB records |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| PostGIS silent omission from Prisma queries | Export — data serialization | Integration test: export a Place, check JSON has `location_geojson` with valid GeoJSON |
| Decimal precision loss in JSON | Export — serialization layer | Unit test: `serializeRecord()` with Decimal fields; assert string output matches `.toString()` |
| Import dependency order violations | Import — table ordering design | Unit test: traverse FK graph of `IMPORT_ORDER` constant; assert each table appears after all its dependencies |
| ID remapping on compound keys | Import — ID remap logic | Integration test: import dataset where all users and places already exist; assert junction tables use target IDs |
| Memory exhaustion during ZIP export | Export — streaming architecture | Load test: export with 1000 synthetic photos; monitor heap with `--inspect`; assert peak < 512MB |
| Next.js body size limit on import upload | Import — upload handler | Test: upload a 500MB synthetic archive; assert handler begins extraction without buffering full body |
| Partial import leaves inconsistent state | Import — transaction design | Failure test: inject error at table 10 of 18; assert zero rows committed across all 18 tables |
| Security token table inclusion | Export — table selection | Security test: inspect archive manifest; assert token table files are absent |
| Photo upload / DB record ordering | Import — photo pipeline | Failure test: inject MinIO upload failure; assert no Photo DB record exists after failed upload |
| ZIP32 4.2GB limit | Export — archive configuration | Test: generate archive with synthetic data exceeding 4GB; open on Linux and macOS |

---

## Sources

- PostGIS `Unsupported` field behavior in Prisma: [prisma/prisma Issue #2789](https://github.com/prisma/prisma/issues/2789), [Request for Geometry/Geography Support #25768](https://github.com/prisma/prisma/issues/25768)
- PostGIS ST_AsGeoJSON / ST_GeomFromGeoJSON patterns: [PostGIS Documentation Chapter 4](https://postgis.net/docs/using_postgis_dbmanagement.html), [freddydumont.com Prisma + PostGIS guide](https://freddydumont.com/blog/prisma-postgis)
- Prisma Decimal serialization: [prisma/prisma Issue #9170](https://github.com/prisma/prisma/issues/9170), [Prisma special fields docs](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types)
- Prisma createMany FK limitation: [Prisma CRUD docs](https://www.prisma.io/docs/orm/prisma-client/queries/crud), [prisma/prisma Discussion #17472](https://github.com/prisma/prisma/discussions/17472)
- Prisma transaction timeout configuration: [Prisma transactions docs](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- archiver memory issues with large files: [archiverjs/node-archiver Issue #233](https://github.com/archiverjs/node-archiver/issues/233), [Issue #422](https://github.com/archiverjs/node-archiver/issues/422), [Medium: Handling Large ZIP Uploads in Node.js](https://medium.com/@pukarlamichhane567/handling-large-zip-uploads-in-node-js-1gb-from-heap-crashes-to-streamed-stability-359075edd0bf)
- ZIP64 4GB limit: [archiverjs/node-archiver Issue #179](https://github.com/archiverjs/node-archiver/issues/179), [nodejs/node Issue #15779](https://github.com/nodejs/node/issues/15779), [yazl npm package](https://www.npmjs.com/package/yazl)
- Next.js response/body size limits: [Next.js docs: API Routes Response Size Limited to 4MB](https://nextjs.org/docs/messages/api-routes-response-size-limit), [vercel/next.js Discussion #34450](https://github.com/vercel/next.js/discussions/34450)
- Circular FK references during import: [Cybertec PostgreSQL: Foreign Keys Circular Dependencies](https://www.cybertec-postgresql.com/en/foreign-keys/), [PostgreSQL: Circular references](https://www.postgresql.org/message-id/CADGQN56ErReL0i8K8qPHzWWka1wZW7j0SGno+kqYThSszS8L3A@mail.gmail.com)
- MinIO multipart upload pitfalls: [MinIO Issue #7206](https://github.com/minio/minio/issues/7206), [MinIO Issue #7714](https://github.com/minio/minio/issues/7714)
- SnackSpot schema: `packages/db/prisma/schema.prisma` (inspected directly — source of truth)
- SnackSpot known concerns: `.planning/codebase/CONCERNS.md` (2026-04-06)

---
*Pitfalls research for: SnackSpot export/import feature — PostgreSQL + PostGIS, Prisma ORM, MinIO, 15-table relational schema*
*Researched: 2026-04-06*
