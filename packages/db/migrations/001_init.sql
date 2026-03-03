CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user','mod','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE review_status AS ENUM ('active','hidden','deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE moderation_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('open','triaged','resolved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  display_name text NOT NULL,
  avatar_photo_id uuid NULL,
  bio text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  user_agent text NULL,
  ip inet NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  street text NULL,
  house_number text NULL,
  postal_code text NULL,
  city text NULL,
  country_code char(2) NULL,
  location geography(Point,4326) NOT NULL,
  created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS place_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_id text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, external_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE RESTRICT,
  dish_name text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  taste_rating smallint NULL CHECK (taste_rating BETWEEN 1 AND 5),
  price_rating smallint NULL CHECK (price_rating BETWEEN 1 AND 5),
  portion_rating smallint NULL CHECK (portion_rating BETWEEN 1 AND 5),
  text text NOT NULL CHECK (char_length(text) BETWEEN 40 AND 2000),
  status review_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  storage_key_original text NOT NULL UNIQUE,
  storage_key_thumb text NOT NULL UNIQUE,
  storage_key_medium text NOT NULL UNIQUE,
  storage_key_large text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  width int NOT NULL CHECK (width > 0),
  height int NOT NULL CHECK (height > 0),
  size_bytes int NOT NULL CHECK (size_bytes > 0),
  checksum_sha256 text NOT NULL,
  moderation_status moderation_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS review_photos (
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES photos(id) ON DELETE RESTRICT,
  sort_order smallint NOT NULL CHECK (sort_order BETWEEN 1 AND 6),
  PRIMARY KEY (review_id, photo_id),
  UNIQUE(review_id, sort_order)
);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS review_tags (
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY(review_id, tag_id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_id uuid NULL REFERENCES reviews(id) ON DELETE CASCADE,
  place_id uuid NULL REFERENCES places(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, review_id, place_id),
  CHECK ((((review_id IS NOT NULL)::int + (place_id IS NOT NULL)::int) = 1))
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  target_type text NOT NULL CHECK (target_type IN ('review','photo','user','place')),
  target_id uuid NOT NULL,
  reason text NOT NULL,
  details text NULL,
  status report_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  action text NOT NULL,
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_places_location_gist ON places USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_place_created ON reviews(place_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user_created ON reviews(user_id, created_at DESC);

DO $$ BEGIN
  ALTER TABLE places ADD COLUMN search_tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(name, ''))
  ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_places_search_tsv ON places USING GIN(search_tsv);

DO $$ BEGIN
  ALTER TABLE reviews ADD COLUMN search_tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(dish_name,'') || ' ' || coalesce(text,''))
  ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_reviews_search_tsv ON reviews USING GIN(search_tsv);
CREATE INDEX IF NOT EXISTS idx_places_name_trgm ON places USING GIN(name gin_trgm_ops);
