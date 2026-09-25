-- Growth, moderation and index maintenance.
--
-- 1. Places can be reported (closed, wrong address, duplicate). ADD VALUE runs inside the
--    migration runner's transaction on PG 12+ because nothing in this file uses 'PLACE'.
-- 2. Marketing email becomes opt-in. Until now the admin broadcast went to every user, which
--    the Dutch Telecommunicatiewet (art. 11.7) does not allow without prior consent. The
--    default is false, so existing users are opted out until they switch it on.
-- 3. Indexes the query patterns and cascades actually need (see GROWTH_PLAN.md §5).

ALTER TYPE "ReportTargetType" ADD VALUE IF NOT EXISTS 'PLACE';

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS place_id TEXT
    REFERENCES places (id) ON DELETE SET NULL;

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS marketing_emails BOOLEAN NOT NULL DEFAULT false;

-- "Bewaard" list on the profile, newest first; the PK (user_id, place_id) cannot order by time.
CREATE INDEX IF NOT EXISTS favorites_user_created_idx ON favorites (user_id, created_at DESC);
-- Cascade on place delete, and "how often is this place saved".
CREATE INDEX IF NOT EXISTS favorites_place_idx ON favorites (place_id);

-- Foreign keys without an index make every cascade a sequential scan: review purges,
-- photo deletes and account erasure all hit these.
CREATE INDEX IF NOT EXISTS review_photos_photo_idx ON review_photos (photo_id);
CREATE INDEX IF NOT EXISTS notifications_review_idx ON notifications (review_id) WHERE review_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_comment_idx ON notifications (comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_actor_idx ON notifications (actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reports_review_idx ON reports (review_id) WHERE review_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reports_photo_idx ON reports (photo_id) WHERE photo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reports_place_idx ON reports (place_id) WHERE place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reports_reporter_idx ON reports (reporter_id);
CREATE INDEX IF NOT EXISTS moderation_actions_moderator_idx ON moderation_actions (moderator_id);

-- Dish aggregation (place page "Dit moet je bestellen", /snackplekken/[stad]/[gerecht],
-- /gerechten/[gerecht]) groups and filters on LOWER(TRIM(dish_name)) over published reviews.
CREATE INDEX IF NOT EXISTS reviews_published_dish_key_idx
  ON reviews (LOWER(TRIM(dish_name)), place_id)
  WHERE status = 'PUBLISHED' AND dish_name IS NOT NULL;
