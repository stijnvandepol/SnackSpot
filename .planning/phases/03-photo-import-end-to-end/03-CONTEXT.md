# Phase 3: Photo Import + End-to-End - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Import photos from the export archive into the target MinIO instance, and validate the full export→import round-trip end-to-end. This phase completes the import pipeline — after Phase 2 imported all relational data, Phase 3 adds the binary photo assets.

</domain>

<decisions>
## Implementation Decisions

### Photo upload approach
- **D-01:** Photo upload happens AFTER the database transaction completes successfully — not inside it. Rationale: MinIO uploads are slow and can't be rolled back in a DB transaction anyway. The DB records (with remapped photo IDs) must exist first so we know which storageKeys to upload.
- **D-02:** Iterate over `photos/` directory entries in the ZIP, match each to a photo record's storageKey, and upload via `minioClient.putObject()`. Use the remapped storageKey from the import's idMaps.
- **D-03:** Photos that already exist in MinIO (by storageKey, checked via `statObject`) are skipped — consistent with the dedup approach for relational data.

### Error handling for photos
- **D-04:** Photo upload failures do NOT abort the import — the database records are already committed. Failed photo uploads are counted and reported in the summary. Rationale: partial photo availability is better than rolling back an entire successful relational import.
- **D-05:** Each failed photo upload logs the storageKey and error reason in the summary report's `photos` section.

### Import summary extension
- **D-06:** Add a `photos` section to the ImportSummary type: `{ uploaded: number, skipped: number, errors: string[] }`. This is separate from the per-table stats — photos are binary assets, not table records.
- **D-07:** The import UI summary report shows photo stats in a fourth colored stat box (alongside Geïmporteerd/Overgeslagen/Tabellen).

### Round-trip validation
- **D-08:** Build a validation script (`scripts/validate-round-trip.ts`) that runs against Docker services: export from instance A, import to instance B (same instance with cleared data works too), compare record counts per table, verify photo accessibility via MinIO `statObject`.
- **D-09:** The script outputs a pass/fail report with per-table counts comparison and photo accessibility check results. Exit code 0 on full match, 1 on any mismatch.
- **D-10:** PostGIS lat/lng values are compared with tolerance (6 decimal places) to handle floating-point serialization differences.

### Integration with existing import route
- **D-11:** Photo upload logic is added to the existing `/api/import` POST handler in `route.ts` — after the transaction block, before returning the response. Not a separate endpoint.
- **D-12:** The import route already parses the full ZIP with `unzipper.Open.buffer()` — photo entries from `photos/` are accessed from the same parsed directory object. No re-parsing needed.

### Claude's Discretion
- Exact MinIO bucket creation/verification before photo uploads
- Concurrency strategy for photo uploads (sequential vs parallel with p-limit)
- Validation script runner (tsx, vitest, or standalone node)
- Whether to add a "Validate" button to the UI or keep validation as CLI-only

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Import route (extend with photo upload)
- `apps/admin/app/api/import/route.ts` — Current import pipeline, add photo upload after transaction
- `apps/admin/app/api/import/types.ts` — ImportSummary type to extend with photo stats

### Export route (defines photo archive format)
- `apps/admin/app/api/export/route.ts` — Photos stored as `photos/{storageKey}`, manifest includes photosCount

### MinIO client
- `apps/admin/lib/minio.ts` — Existing admin MinIO client with `minioClient` and `BUCKET` exports

### Import UI
- `apps/admin/app/dashboard/export/page.tsx` — Summary report UI to extend with photo stats

### Database schema
- `packages/db/prisma/schema.prisma` — Photo model with storageKey field

### Requirements
- `.planning/REQUIREMENTS.md` — IMP-07 (photo upload to target MinIO)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/admin/lib/minio.ts` — MinIO client ready for `putObject()` and `statObject()` calls
- `apps/admin/app/api/import/route.ts` — Already parses ZIP, has photo dedup map (`existingPhotosByKey`), and remaps photo IDs
- `apps/admin/app/api/import/types.ts` — ImportSummary and IdMaps types to extend

### Established Patterns
- Export uses `minioClient.getObject(BUCKET, photo.storageKey)` to read photos — import mirrors with `putObject`
- Export counts `photosExported` and `photosSkipped` — import should follow same counting pattern
- Photo storageKey is the unique identifier across both export and import

### Integration Points
- Photo upload code slots into `route.ts` between the `$transaction()` block and the `Response.json(result)` return
- `ImportSummary` type gets a new `photos` field
- UI page gets an additional stat box for photo counts
- New validation script in `scripts/` directory

</code_context>

<specifics>
## Specific Ideas

- User wants Claude to test via Docker — validation script should be runnable against the local Docker compose stack
- User prefers autonomous execution — minimal checkpoints needed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-photo-import-end-to-end*
*Context gathered: 2026-04-06*
