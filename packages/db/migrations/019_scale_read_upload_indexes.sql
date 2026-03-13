CREATE INDEX IF NOT EXISTS photos_uploader_status_created_idx
  ON photos (uploader_id, moderation_status, created_at DESC);

CREATE INDEX IF NOT EXISTS photos_status_created_idx
  ON photos (moderation_status, created_at DESC);

CREATE INDEX IF NOT EXISTS photos_uploader_created_idx
  ON photos (uploader_id, created_at DESC);

-- Rollback strategy (manual):
-- DROP INDEX IF EXISTS photos_uploader_status_created_idx;
-- DROP INDEX IF EXISTS photos_status_created_idx;
-- DROP INDEX IF EXISTS photos_uploader_created_idx;
