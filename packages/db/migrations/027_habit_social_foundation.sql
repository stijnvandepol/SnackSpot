-- Habit & social foundation (product-vision fase 1/2):
--   * bites      — the daily logging unit: a photo of any meal, place optional
--   * user_stats — denormalised XP/level/counters (source of truth: xp_events)
--   * xp_events  — append-only XP ledger, dedupable per (user, reason, ref)
--   * follows    — asymmetric follow graph (mutual follow = "friends")
--   * users.timezone — IANA zone for local-date streaks and meal-timed pushes

ALTER TABLE users ADD COLUMN timezone TEXT;

CREATE TYPE "MealSlot" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');
CREATE TYPE "BiteVisibility" AS ENUM ('PRIVATE', 'FRIENDS');

CREATE TABLE bites (
  id         TEXT             NOT NULL DEFAULT gen_random_uuid()::text,
  user_id    TEXT             NOT NULL,
  photo_id   TEXT             NOT NULL,
  place_id   TEXT,
  review_id  TEXT,
  meal_slot  "MealSlot"       NOT NULL DEFAULT 'SNACK',
  note       VARCHAR(280),
  visibility "BiteVisibility" NOT NULL DEFAULT 'FRIENDS',
  -- The calendar day in the user's own timezone; streaks count these days.
  local_date DATE             NOT NULL,
  created_at TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT bites_pkey PRIMARY KEY (id),
  CONSTRAINT bites_photo_id_key UNIQUE (photo_id),
  CONSTRAINT bites_review_id_key UNIQUE (review_id),
  CONSTRAINT bites_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT bites_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  CONSTRAINT bites_place_id_fkey FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE SET NULL,
  CONSTRAINT bites_review_id_fkey FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE SET NULL
);

CREATE INDEX bites_user_id_local_date_idx ON bites (user_id, local_date DESC);
CREATE INDEX bites_user_id_created_at_idx ON bites (user_id, created_at DESC);
CREATE INDEX bites_place_id_idx ON bites (place_id);
-- Friends-feed lookups: recent bites by a set of users, friends-visible only.
CREATE INDEX bites_visibility_created_at_idx ON bites (visibility, created_at DESC);

CREATE TABLE user_stats (
  user_id     TEXT        NOT NULL,
  xp_total    INTEGER     NOT NULL DEFAULT 0,
  level       INTEGER     NOT NULL DEFAULT 1,
  bites_count INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_stats_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE xp_events (
  id         TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  user_id    TEXT        NOT NULL,
  amount     INTEGER     NOT NULL,
  reason     TEXT        NOT NULL,
  ref_type   TEXT,
  ref_id     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT xp_events_pkey PRIMARY KEY (id),
  CONSTRAINT xp_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX xp_events_user_id_created_at_idx ON xp_events (user_id, created_at DESC);
-- Dedup: the same reason for the same ref never awards twice (NULL refs may repeat).
CREATE UNIQUE INDEX xp_events_user_id_reason_ref_type_ref_id_key
  ON xp_events (user_id, reason, ref_type, ref_id);

CREATE TABLE follows (
  follower_id TEXT        NOT NULL,
  followee_id TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT follows_pkey PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT follows_no_self_follow CHECK (follower_id <> followee_id),
  CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT follows_followee_id_fkey FOREIGN KEY (followee_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX follows_followee_id_idx ON follows (followee_id);
