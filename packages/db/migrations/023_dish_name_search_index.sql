-- Add GIN index on review dish_name for full-text search.
-- This enables searching places by the dishes reviewed there.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_dish_name_fts
  ON reviews USING GIN (to_tsvector('english', COALESCE(dish_name, '')));
