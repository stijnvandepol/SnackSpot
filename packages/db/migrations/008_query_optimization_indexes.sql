CREATE INDEX IF NOT EXISTS reports_status_created_at_idx
  ON reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS reviews_place_status_rating_created_idx
  ON reviews (place_id, status, rating DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS reviews_user_status_place_idx
  ON reviews (user_id, status, place_id);

CREATE INDEX IF NOT EXISTS reviews_user_status_id_idx
  ON reviews (user_id, status, id);

CREATE INDEX IF NOT EXISTS review_photos_review_sort_idx
  ON review_photos (review_id, sort_order);

CREATE INDEX IF NOT EXISTS user_badges_user_earned_created_idx
  ON user_badges (user_id, earned_at DESC, created_at ASC);

-- Rollback strategy (manual):
-- DROP INDEX IF EXISTS reports_status_created_at_idx;
-- DROP INDEX IF EXISTS reviews_place_status_rating_created_idx;
-- DROP INDEX IF EXISTS reviews_user_status_place_idx;
-- DROP INDEX IF EXISTS reviews_user_status_id_idx;
-- DROP INDEX IF EXISTS review_photos_review_sort_idx;
-- DROP INDEX IF EXISTS user_badges_user_earned_created_idx;
