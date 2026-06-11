-- Place verification: every place gets a stable external identity so the same
-- real-world venue maps to exactly one row, killing near-duplicate entries.
--
--   provider          - the source that verified the venue (e.g. 'osm', 'google')
--   provider_place_id  - the provider's stable id for that venue
--
-- The (provider, provider_place_id) pair is unique: re-selecting the same venue
-- from autocomplete resolves to the existing row instead of creating a copy.
-- Existing rows keep provider = 'manual' and a NULL provider_place_id (the
-- partial unique index ignores NULLs, so legacy/manual rows don't collide).

ALTER TABLE places
  ADD COLUMN provider          TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN provider_place_id TEXT;

CREATE UNIQUE INDEX places_provider_place_id_key
  ON places (provider, provider_place_id)
  WHERE provider_place_id IS NOT NULL;

-- Supports the name+proximity duplicate guard for manual entries: a trigram
-- index on the lowercased name (the spatial GiST index already exists).
CREATE INDEX IF NOT EXISTS idx_places_name_lower_trgm
  ON places USING GIN (LOWER(name) gin_trgm_ops);
