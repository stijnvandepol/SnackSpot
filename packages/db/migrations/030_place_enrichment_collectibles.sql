-- Place enrichment + Food Passport v1 (product-vision hoofdstuk 3 B9 / 9 §6+§9).
--
-- places.city/cuisine unblock the cuisine passport sets and the future
-- city×dish SEO hubs. City is backfilled with a last-comma heuristic and is
-- admin-correctable; cuisine starts empty (admin/heuristic fills it later).
--
-- Collectibles are content (like quest templates): criteria live in JSONB so
-- new sets ship without schema changes. Seeded sets only use data that exists
-- today (dish names, unique places, cities) — cuisine sets follow once
-- places.cuisine is populated, so no set is ever shown that cannot be earned.

ALTER TABLE places
  ADD COLUMN city TEXT,
  ADD COLUMN cuisine TEXT;

-- Heuristic backfill: the segment after the last comma is the city for the
-- overwhelming majority of "Street 1, City" style addresses.
UPDATE places
SET city = NULLIF(TRIM(SPLIT_PART(address, ',', -1)), '')
WHERE city IS NULL AND address LIKE '%,%';

CREATE INDEX places_city_idx ON places (city) WHERE city IS NOT NULL;

CREATE TABLE collectibles (
  id          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  set_key     TEXT        NOT NULL,
  item_key    TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL,
  icon        TEXT        NOT NULL,
  criteria    JSONB       NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT collectibles_pkey PRIMARY KEY (id),
  CONSTRAINT collectibles_set_key_item_key_key UNIQUE (set_key, item_key)
);

CREATE TABLE user_collectibles (
  user_id        TEXT        NOT NULL,
  collectible_id TEXT        NOT NULL,
  earned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_collectibles_pkey PRIMARY KEY (user_id, collectible_id),
  CONSTRAINT user_collectibles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT user_collectibles_collectible_id_fkey FOREIGN KEY (collectible_id) REFERENCES collectibles(id) ON DELETE CASCADE
);

-- ── Set: De Hollandse Vijf — earn a stamp per reviewed Dutch classic ─────────
INSERT INTO collectibles (set_key, item_key, name, description, icon, criteria, sort_order) VALUES
  ('dutch-classics', 'stroopwafel', 'Stroopwafel', 'Review a stroopwafel.', '🧇',
   '{"type":"DISH_MATCH","patterns":["stroopwafel"]}', 1),
  ('dutch-classics', 'haring', 'Haring', 'Review a herring - Hollandse Nieuwe counts double (not really).', '🐟',
   '{"type":"DISH_MATCH","patterns":["haring","herring","hollandse nieuwe"]}', 2),
  ('dutch-classics', 'bitterballen', 'Bitterballen', 'Review bitterballen. The perfect biersnack.', '🟤',
   '{"type":"DISH_MATCH","patterns":["bitterbal"]}', 3),
  ('dutch-classics', 'kapsalon', 'Kapsalon', 'Review a kapsalon. No judgement.', '🍟',
   '{"type":"DISH_MATCH","patterns":["kapsalon"]}', 4),
  ('dutch-classics', 'kibbeling', 'Kibbeling', 'Review kibbeling, extra knoflooksaus.', '🍤',
   '{"type":"DISH_MATCH","patterns":["kibbeling"]}', 5);

-- ── Set: Spot milestones — unique places reviewed ────────────────────────────
INSERT INTO collectibles (set_key, item_key, name, description, icon, criteria, sort_order) VALUES
  ('spot-milestones', 'first-spot',  'First Spot',     'Review your first place.', '📍',
   '{"type":"UNIQUE_PLACES","value":1}', 1),
  ('spot-milestones', 'five-spots',  'Spot Collector', 'Review 5 different places.', '🗺️',
   '{"type":"UNIQUE_PLACES","value":5}', 2),
  ('spot-milestones', 'ten-spots',   'Spot Hunter',    'Review 10 different places.', '🧭',
   '{"type":"UNIQUE_PLACES","value":10}', 3),
  ('spot-milestones', 'twentyfive-spots', 'Spot Legend', 'Review 25 different places.', '🏆',
   '{"type":"UNIQUE_PLACES","value":25}', 4);

-- ── Set: City explorer — different cities eaten in ───────────────────────────
INSERT INTO collectibles (set_key, item_key, name, description, icon, criteria, sort_order) VALUES
  ('city-explorer', 'two-cities',   'Day Tripper',   'Review places in 2 different cities.', '🚉',
   '{"type":"UNIQUE_CITIES","value":2}', 1),
  ('city-explorer', 'three-cities', 'Road Tripper',  'Review places in 3 different cities.', '🚗',
   '{"type":"UNIQUE_CITIES","value":3}', 2),
  ('city-explorer', 'five-cities',  'Food Nomad',    'Review places in 5 different cities.', '✈️',
   '{"type":"UNIQUE_CITIES","value":5}', 3);
