DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'BadgeCriteriaType' AND e.enumlabel = 'COMMENTS_RECEIVED_COUNT'
  ) THEN
    ALTER TYPE "BadgeCriteriaType" ADD VALUE 'COMMENTS_RECEIVED_COUNT';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'BadgeCriteriaType' AND e.enumlabel = 'BEST_STREAK_DAYS'
  ) THEN
    ALTER TYPE "BadgeCriteriaType" ADD VALUE 'BEST_STREAK_DAYS';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'BadgeCriteriaType' AND e.enumlabel = 'POSTS_LAST_30_DAYS'
  ) THEN
    ALTER TYPE "BadgeCriteriaType" ADD VALUE 'POSTS_LAST_30_DAYS';
  END IF;
END $$;

INSERT INTO badges (slug, name, description, icon_key, tier, criteria_type, criteria_value)
VALUES
  ('first-post', 'First Bite', 'Publish your first SnackSpot post.', 'sparkles', 'BRONZE', 'POSTS_COUNT', 1),
  ('five-posts', 'On The Menu', 'Publish 5 posts.', 'utensils-crossed', 'BRONZE', 'POSTS_COUNT', 5),
  ('ten-posts', 'Regular Reviewer', 'Publish 10 posts.', 'clipboard-check', 'SILVER', 'POSTS_COUNT', 10),
  ('twenty-five-posts', 'Snack Critic', 'Publish 25 posts.', 'medal', 'GOLD', 'POSTS_COUNT', 25),
  ('local-explorer', 'Local Explorer', 'Review 5 unique places.', 'map-pin', 'BRONZE', 'UNIQUE_LOCATIONS_COUNT', 5),
  ('city-taster', 'City Taster', 'Review 15 unique places.', 'map', 'SILVER', 'UNIQUE_LOCATIONS_COUNT', 15),
  ('streak-3', 'Warm-Up Streak', 'Post 3 days in a row.', 'flame', 'BRONZE', 'BEST_STREAK_DAYS', 3),
  ('streak-7', 'Hot Streak', 'Post 7 days in a row.', 'flame-kindling', 'SILVER', 'BEST_STREAK_DAYS', 7),
  ('streak-14', 'Unstoppable', 'Post 14 days in a row.', 'trophy', 'GOLD', 'BEST_STREAK_DAYS', 14),
  ('month-5', 'Monthly Momentum', 'Publish 5 posts in 30 days.', 'calendar-days', 'BRONZE', 'POSTS_LAST_30_DAYS', 5),
  ('month-15', 'Always Posting', 'Publish 15 posts in 30 days.', 'calendar-range', 'SILVER', 'POSTS_LAST_30_DAYS', 15),
  ('likes-10', 'Liked By Locals', 'Receive 10 likes on your posts.', 'thumbs-up', 'BRONZE', 'LIKES_RECEIVED_COUNT', 10),
  ('likes-50', 'Crowd Favorite', 'Receive 50 likes on your posts.', 'heart-handshake', 'SILVER', 'LIKES_RECEIVED_COUNT', 50),
  ('comments-10', 'Conversation Starter', 'Receive 10 comments on your posts.', 'message-circle', 'BRONZE', 'COMMENTS_RECEIVED_COUNT', 10),
  ('comments-25', 'Talk Of The Town', 'Receive 25 comments on your posts.', 'messages-square', 'GOLD', 'COMMENTS_RECEIVED_COUNT', 25)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon_key = EXCLUDED.icon_key,
  tier = EXCLUDED.tier,
  criteria_type = EXCLUDED.criteria_type,
  criteria_value = EXCLUDED.criteria_value,
  is_active = true;
