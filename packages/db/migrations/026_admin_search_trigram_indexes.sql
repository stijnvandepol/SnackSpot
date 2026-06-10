-- Trigram indexes for the admin panel's ILIKE '%term%' searches.
-- The admin list endpoints filter with case-insensitive contains on these
-- columns (users: email/username, places: address, reviews: text); without a
-- trigram index each search is a sequential scan. pg_trgm is already enabled
-- (001, 024). places.name (001) and reviews.dish_name (024) are covered.

CREATE INDEX IF NOT EXISTS idx_users_email_trgm
  ON users USING GIN (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_username_trgm
  ON users USING GIN (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_places_address_trgm
  ON places USING GIN (address gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_reviews_text_trgm
  ON reviews USING GIN (text gin_trgm_ops);
