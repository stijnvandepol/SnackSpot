DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'photos_uploader_id_fkey'
  ) THEN
    ALTER TABLE photos
      ADD CONSTRAINT photos_uploader_id_fkey
      FOREIGN KEY (uploader_id) REFERENCES users (id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS photos_uploader_id_idx ON photos (uploader_id);
