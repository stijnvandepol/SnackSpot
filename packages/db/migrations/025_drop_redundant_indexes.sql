-- Drop indexes that are fully covered by an existing composite index.
-- A B-tree index on (a, b) already serves equality/range lookups and FK-cascade
-- checks on the leading column `a`, so a separate single-column index on `a` is
-- redundant: it only adds write overhead and storage without enabling any plan
-- the composite can't already produce. One pair is also an exact duplicate.
--
-- These standalone indexes exist only in the SQL migrations (005/006/007), not in
-- schema.prisma (which declares only the composites), so dropping them aligns the
-- live database with the Prisma schema.
--
-- DROP INDEX (without CONCURRENTLY) is used because the migration runner wraps each
-- file in a transaction; dropping an index takes only a brief lock and is fast.

-- Exact duplicate of review_likes_review_id_created_at_idx (005) — same columns,
-- same order: review_likes (review_id, created_at DESC).
DROP INDEX IF EXISTS review_likes_review_created_idx;

-- Prefix-subset of review_likes_review_id_created_at_idx (005) — (review_id) is the
-- leading column of (review_id, created_at DESC).
DROP INDEX IF EXISTS review_likes_review_idx;

-- Prefix-subset of reviews_place_id_created_at_idx (001) — (place_id) is the leading
-- column of (place_id, created_at DESC).
DROP INDEX IF EXISTS reviews_place_idx;

-- Rollback strategy (manual):
-- CREATE INDEX IF NOT EXISTS review_likes_review_created_idx ON review_likes (review_id, created_at DESC);
-- CREATE INDEX IF NOT EXISTS review_likes_review_idx ON review_likes (review_id);
-- CREATE INDEX IF NOT EXISTS reviews_place_idx ON reviews (place_id);
