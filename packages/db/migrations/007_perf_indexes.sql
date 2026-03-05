CREATE INDEX IF NOT EXISTS reviews_status_created_id_idx
  ON reviews (status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS reviews_user_status_created_idx
  ON reviews (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS reviews_place_status_created_idx
  ON reviews (place_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS review_likes_review_created_idx
  ON review_likes (review_id, created_at DESC);

CREATE INDEX IF NOT EXISTS review_likes_user_created_idx
  ON review_likes (user_id, created_at DESC);

-- Rollback strategy (manual):
-- DROP INDEX IF EXISTS reviews_status_created_id_idx;
-- DROP INDEX IF EXISTS reviews_user_status_created_idx;
-- DROP INDEX IF EXISTS reviews_place_status_created_idx;
-- DROP INDEX IF EXISTS review_likes_review_created_idx;
-- DROP INDEX IF EXISTS review_likes_user_created_idx;
