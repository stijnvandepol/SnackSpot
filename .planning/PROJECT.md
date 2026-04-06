# SnackSpot — Admin Export/Import

## What This Is

An export and import feature for the SnackSpot admin panel that allows administrators to download a complete backup of all application data (including photos) as a ZIP archive, and import that archive into a new or existing instance with full data validation and relationship preservation.

## Core Value

A complete, validated data transfer between instances — every record, every relationship, every photo — without data loss or corruption.

## Requirements

### Validated

- ✓ Admin panel with JWT auth and role-based access — existing
- ✓ Full CRUD for users, reviews, places, reports, comments — existing
- ✓ Photo storage via MinIO with variant processing — existing
- ✓ PostgreSQL + PostGIS data model with 15+ related tables — existing
- ✓ Prisma ORM with typed schema — existing

### Active

- [ ] Admin can export all database data + photo files as a single ZIP download
- [ ] Export includes all tables with relationships preserved in JSON format
- [ ] Admin can upload a ZIP archive to import data into the instance
- [ ] Import validates all data before writing (schema validation, referential integrity)
- [ ] Import merges with existing data — duplicates detected via unique fields (email for users, name+address for places)
- [ ] Existing records are preserved when duplicates are found (no overwrite)
- [ ] Foreign key relationships are remapped correctly during import (ID remapping)
- [ ] Photos from the archive are uploaded to the target MinIO instance
- [ ] Import provides a summary report (imported, skipped, errors)
- [ ] PostGIS geography data (place locations) is correctly serialized and deserialized
- [ ] Export/import UI integrated into admin dashboard

### Out of Scope

- Incremental/differential backups — full export only, keeps complexity down
- Scheduled automatic exports — manual trigger from admin panel only
- Export filtering (subset of data) — always exports everything
- Cross-version migration — import expects same schema version
- Real-time progress streaming — simple progress indication is sufficient

## Context

- **Monorepo**: pnpm workspace with `apps/web`, `apps/admin`, `apps/worker`, `packages/db`
- **Admin app**: Next.js 15 on port 3001, JWT auth with access/refresh tokens
- **Database**: PostgreSQL 16 + PostGIS 3.4, Prisma 5.22.0 ORM
- **File storage**: MinIO (S3-compatible), Sharp for image processing
- **Data model**: Users, Places, Reviews, Photos, Comments, Reports, Badges, Notifications, ModerationActions, BlockedWords, FlaggedComments, ReviewLikes, Favorites, ReviewTags, UserBadges, ReviewPhotos, ReviewMentions
- **Special types**: PostGIS geography points, JSON columns (photo variants/metadata), Decimal ratings
- **Compound keys**: ReviewLike (userId+reviewId), Favorite (userId+placeId), ReviewTag (reviewId+tag)
- **No existing file upload/download in admin** — this is the first

## Constraints

- **Tech stack**: Must use existing Next.js API routes in admin app, Prisma for DB access, MinIO client for photos
- **Auth**: All endpoints must use existing `requireAdmin()` middleware
- **ZIP size**: Large instances may produce multi-GB archives — needs streaming approach, not in-memory
- **PostGIS**: Geography data needs special handling (not standard JSON serializable)
- **Import order**: Tables must be imported in dependency order (users before reviews, places before reviews, etc.)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| ZIP as export format | Single file contains both JSON data and photo binaries, simplest for download/upload/storage | — Pending |
| Unique field matching for duplicates | More meaningful than UUID matching across instances; email for users, name+address for places | — Pending |
| Skip-on-duplicate strategy | Preserves existing data, safer than overwriting for both backup and migration use cases | — Pending |
| Streaming ZIP generation | Avoids memory issues with large datasets and many photos | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-06 after initialization*
