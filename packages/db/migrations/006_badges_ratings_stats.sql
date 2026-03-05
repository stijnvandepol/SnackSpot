-- Add structured ratings to reviews
ALTER TABLE reviews
  ADD COLUMN rating_taste SMALLINT,
  ADD COLUMN rating_value SMALLINT,
  ADD COLUMN rating_portion SMALLINT,
  ADD COLUMN rating_service SMALLINT,
  ADD COLUMN rating_overall NUMERIC(2,1);

UPDATE reviews
SET
  rating_taste = rating,
  rating_value = rating,
  rating_portion = rating,
  rating_service = NULL,
  rating_overall = ROUND(rating::numeric, 1)
WHERE rating_taste IS NULL OR rating_value IS NULL OR rating_portion IS NULL OR rating_overall IS NULL;

ALTER TABLE reviews
  ALTER COLUMN rating_taste SET NOT NULL,
  ALTER COLUMN rating_taste SET DEFAULT 0,
  ALTER COLUMN rating_value SET NOT NULL,
  ALTER COLUMN rating_value SET DEFAULT 0,
  ALTER COLUMN rating_portion SET NOT NULL,
  ALTER COLUMN rating_portion SET DEFAULT 0,
  ALTER COLUMN rating_overall SET NOT NULL,
  ALTER COLUMN rating_overall SET DEFAULT 0;

ALTER TABLE reviews
  ADD CONSTRAINT reviews_rating_taste_range CHECK (rating_taste BETWEEN 1 AND 5),
  ADD CONSTRAINT reviews_rating_value_range CHECK (rating_value BETWEEN 1 AND 5),
  ADD CONSTRAINT reviews_rating_portion_range CHECK (rating_portion BETWEEN 1 AND 5),
  ADD CONSTRAINT reviews_rating_service_range CHECK (rating_service IS NULL OR (rating_service BETWEEN 1 AND 5)),
  ADD CONSTRAINT reviews_rating_overall_range CHECK (rating_overall BETWEEN 1.0 AND 5.0);

-- Badge catalog + user progress
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BadgeTier') THEN
    CREATE TYPE "BadgeTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BadgeCriteriaType') THEN
    CREATE TYPE "BadgeCriteriaType" AS ENUM (
      'POSTS_COUNT',
      'UNIQUE_LOCATIONS_COUNT',
      'ACTIVE_DAYS_COUNT',
      'LIKES_RECEIVED_COUNT'
    );
  END IF;
END$$;

CREATE TABLE badges (
  id             TEXT               NOT NULL DEFAULT gen_random_uuid()::text,
  slug           TEXT               NOT NULL,
  name           TEXT               NOT NULL,
  description    TEXT               NOT NULL,
  icon_key       TEXT               NOT NULL,
  tier           "BadgeTier"       NOT NULL,
  criteria_type  "BadgeCriteriaType" NOT NULL,
  criteria_value INTEGER            NOT NULL,
  is_active      BOOLEAN            NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  CONSTRAINT badges_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX badges_slug_key ON badges (slug);
CREATE INDEX badges_active_idx ON badges (is_active, created_at DESC);

CREATE TABLE user_badges (
  user_id           TEXT         NOT NULL,
  badge_id          TEXT         NOT NULL,
  progress_current  INTEGER      NOT NULL DEFAULT 0,
  progress_target   INTEGER      NOT NULL DEFAULT 0,
  earned_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT user_badges_pkey PRIMARY KEY (user_id, badge_id),
  CONSTRAINT user_badges_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT user_badges_badge_id_fkey
    FOREIGN KEY (badge_id) REFERENCES badges (id) ON DELETE CASCADE
);

CREATE INDEX user_badges_user_earned_idx ON user_badges (user_id, earned_at DESC);

INSERT INTO badges (slug, name, description, icon_key, tier, criteria_type, criteria_value)
VALUES
  ('first-post', 'First Post', 'Create your first post.', 'award', 'BRONZE', 'POSTS_COUNT', 1),
  ('reviewer-silver', 'Reviewer', 'Create 10 posts.', 'clipboard-check', 'SILVER', 'POSTS_COUNT', 10),
  ('reviewer-gold', 'Reviewer', 'Create 50 posts.', 'medal', 'GOLD', 'POSTS_COUNT', 50),
  ('local-explorer-silver', 'Local Explorer', 'Post from 5 unique locations.', 'map-pin', 'SILVER', 'UNIQUE_LOCATIONS_COUNT', 5),
  ('local-explorer-gold', 'Local Explorer', 'Post from 20 unique locations.', 'map', 'GOLD', 'UNIQUE_LOCATIONS_COUNT', 20),
  ('consistent', 'Consistent', 'Post on 7 different days.', 'calendar-check', 'SILVER', 'ACTIVE_DAYS_COUNT', 7),
  ('top-rated', 'Top Rated', 'Receive 25 likes on your posts.', 'thumbs-up', 'SILVER', 'LIKES_RECEIVED_COUNT', 25)
ON CONFLICT (slug) DO NOTHING;

CREATE INDEX IF NOT EXISTS reviews_user_created_idx ON reviews (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_place_idx ON reviews (place_id);
CREATE INDEX IF NOT EXISTS review_likes_review_idx ON review_likes (review_id);

-- Rollback strategy (manual):
-- DROP TABLE IF EXISTS user_badges;
-- DROP TABLE IF EXISTS badges;
-- ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_rating_taste_range;
-- ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_rating_value_range;
-- ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_rating_portion_range;
-- ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_rating_service_range;
-- ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_rating_overall_range;
-- ALTER TABLE reviews DROP COLUMN IF EXISTS rating_taste, DROP COLUMN IF EXISTS rating_value,
--   DROP COLUMN IF EXISTS rating_portion, DROP COLUMN IF EXISTS rating_service, DROP COLUMN IF EXISTS rating_overall;
-- DROP TYPE IF EXISTS "BadgeCriteriaType";
-- DROP TYPE IF EXISTS "BadgeTier";
