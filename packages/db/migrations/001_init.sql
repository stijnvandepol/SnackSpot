-- SnackSpot – initial schema
-- Requires PostGIS extension (available in postgis/postgis Docker image)

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- trigram index for LIKE search

-- ─── Enum types ──────────────────────────────────────────────────────────────
CREATE TYPE "Role" AS ENUM ('USER', 'MODERATOR', 'ADMIN');
CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'DELETED');
CREATE TYPE "PhotoModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');
CREATE TYPE "ReportTargetType" AS ENUM ('REVIEW', 'PHOTO', 'USER');
CREATE TYPE "ModerationActionType" AS ENUM (
  'HIDE_REVIEW','UNHIDE_REVIEW','DELETE_REVIEW',
  'DELETE_PHOTO','BAN_USER','UNBAN_USER','DISMISS_REPORT'
);

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  email         TEXT        NOT NULL,
  username      TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  role          "Role"      NOT NULL DEFAULT 'USER',
  display_name  TEXT,
  avatar_key    TEXT,
  banned_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX users_email_key    ON users (email);
CREATE UNIQUE INDEX users_username_key ON users (username);

-- ─── Refresh tokens ──────────────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id         TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  user_id    TEXT        NOT NULL,
  token_hash TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT refresh_tokens_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX refresh_tokens_token_hash_key ON refresh_tokens (token_hash);

-- ─── Places ──────────────────────────────────────────────────────────────────
CREATE TABLE places (
  id         TEXT                      NOT NULL DEFAULT gen_random_uuid()::text,
  name       TEXT                      NOT NULL,
  address    TEXT                      NOT NULL,
  location   geography(Point, 4326)    NOT NULL,
  created_at TIMESTAMPTZ               NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ               NOT NULL DEFAULT NOW(),
  CONSTRAINT places_pkey PRIMARY KEY (id)
);

-- GiST spatial index
CREATE INDEX places_location_gist_idx ON places USING GIST (location);
-- Full-text search on place name + address
CREATE INDEX places_fts_idx ON places USING GIN (
  to_tsvector('english', name || ' ' || address)
);
CREATE INDEX places_name_trgm_idx ON places USING GIN (name gin_trgm_ops);

-- ─── Reviews ─────────────────────────────────────────────────────────────────
CREATE TABLE reviews (
  id         TEXT           NOT NULL DEFAULT gen_random_uuid()::text,
  user_id    TEXT           NOT NULL,
  place_id   TEXT           NOT NULL,
  rating     SMALLINT       NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text       TEXT           NOT NULL,
  dish_name  TEXT,
  status     "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
  created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_user_id_fkey
    FOREIGN KEY (user_id)  REFERENCES users  (id) ON DELETE CASCADE,
  CONSTRAINT reviews_place_id_fkey
    FOREIGN KEY (place_id) REFERENCES places (id) ON DELETE CASCADE
);

CREATE INDEX reviews_created_at_idx          ON reviews (created_at DESC);
CREATE INDEX reviews_place_id_created_at_idx ON reviews (place_id, created_at DESC);
CREATE INDEX reviews_user_id_created_at_idx  ON reviews (user_id,  created_at DESC);
-- Full-text search over review text + dish name
CREATE INDEX reviews_fts_idx ON reviews USING GIN (
  to_tsvector('english', text || ' ' || COALESCE(dish_name, ''))
);

-- ─── Photos ──────────────────────────────────────────────────────────────────
CREATE TABLE photos (
  id                TEXT                   NOT NULL DEFAULT gen_random_uuid()::text,
  storage_key       TEXT                   NOT NULL,
  uploader_id       TEXT                   NOT NULL,
  variants          JSONB                  NOT NULL DEFAULT '{}',
  metadata          JSONB                  NOT NULL DEFAULT '{}',
  moderation_status "PhotoModerationStatus" NOT NULL DEFAULT 'PENDING',
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  CONSTRAINT photos_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX photos_storage_key_key ON photos (storage_key);

-- ─── Review ↔ Photo junction ─────────────────────────────────────────────────
CREATE TABLE review_photos (
  review_id  TEXT    NOT NULL,
  photo_id   TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT review_photos_pkey PRIMARY KEY (review_id, photo_id),
  CONSTRAINT review_photos_review_id_fkey
    FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE,
  CONSTRAINT review_photos_photo_id_fkey
    FOREIGN KEY (photo_id)  REFERENCES photos  (id) ON DELETE CASCADE
);

-- ─── Favorites ───────────────────────────────────────────────────────────────
CREATE TABLE favorites (
  user_id    TEXT        NOT NULL,
  place_id   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT favorites_pkey PRIMARY KEY (user_id, place_id),
  CONSTRAINT favorites_user_id_fkey
    FOREIGN KEY (user_id)  REFERENCES users  (id) ON DELETE CASCADE,
  CONSTRAINT favorites_place_id_fkey
    FOREIGN KEY (place_id) REFERENCES places (id) ON DELETE CASCADE
);

-- ─── Reports ─────────────────────────────────────────────────────────────────
CREATE TABLE reports (
  id          TEXT               NOT NULL DEFAULT gen_random_uuid()::text,
  reporter_id TEXT               NOT NULL,
  target_type "ReportTargetType" NOT NULL,
  review_id   TEXT,
  photo_id    TEXT,
  reason      TEXT               NOT NULL,
  status      "ReportStatus"     NOT NULL DEFAULT 'OPEN',
  created_at  TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  CONSTRAINT reports_pkey PRIMARY KEY (id),
  CONSTRAINT reports_reporter_id_fkey
    FOREIGN KEY (reporter_id) REFERENCES users   (id) ON DELETE CASCADE,
  CONSTRAINT reports_review_id_fkey
    FOREIGN KEY (review_id)   REFERENCES reviews (id) ON DELETE SET NULL,
  CONSTRAINT reports_photo_id_fkey
    FOREIGN KEY (photo_id)    REFERENCES photos  (id) ON DELETE SET NULL
);

CREATE INDEX reports_status_idx ON reports (status);

-- ─── Moderation actions ──────────────────────────────────────────────────────
CREATE TABLE moderation_actions (
  id           TEXT                   NOT NULL DEFAULT gen_random_uuid()::text,
  moderator_id TEXT                   NOT NULL,
  action_type  "ModerationActionType" NOT NULL,
  target_type  TEXT                   NOT NULL,
  target_id    TEXT                   NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  CONSTRAINT moderation_actions_pkey PRIMARY KEY (id),
  CONSTRAINT moderation_actions_moderator_id_fkey
    FOREIGN KEY (moderator_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX moderation_actions_created_at_idx ON moderation_actions (created_at DESC);

-- ─── Auto-update updated_at ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_places
  BEFORE UPDATE ON places
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_reviews
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
