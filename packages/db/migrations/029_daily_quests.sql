-- Daily quests (product-vision hoofdstuk 3, B3): 2-3 small goals per local
-- day. Templates are content (admin-editable later); user_quests snapshots
-- the criteria/target/reward at assignment time so template edits never
-- change a quest mid-day.

CREATE TABLE quest_templates (
  id            TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  key           TEXT        NOT NULL,
  title         TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  criteria_type TEXT        NOT NULL,
  target        INTEGER     NOT NULL DEFAULT 1,
  reward_xp     INTEGER     NOT NULL,
  active        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT quest_templates_pkey PRIMARY KEY (id),
  CONSTRAINT quest_templates_key_key UNIQUE (key)
);

CREATE TABLE user_quests (
  id            TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  user_id       TEXT        NOT NULL,
  template_id   TEXT        NOT NULL,
  assigned_date DATE        NOT NULL,
  criteria_type TEXT        NOT NULL,
  title         TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  progress      INTEGER     NOT NULL DEFAULT 0,
  target        INTEGER     NOT NULL,
  reward_xp     INTEGER     NOT NULL,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_quests_pkey PRIMARY KEY (id),
  CONSTRAINT user_quests_user_template_date_key UNIQUE (user_id, template_id, assigned_date),
  CONSTRAINT user_quests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT user_quests_template_id_fkey FOREIGN KEY (template_id) REFERENCES quest_templates(id) ON DELETE CASCADE
);

CREATE INDEX user_quests_user_id_assigned_date_idx ON user_quests (user_id, assigned_date DESC);

-- Starter quest pool. "Log a meal" is in every daily set; the rest rotate.
INSERT INTO quest_templates (key, title, description, criteria_type, target, reward_xp) VALUES
  ('daily-bite',       'Log a meal',             'One photo of anything you eat today.',            'BITES_LOGGED',       1, 15),
  ('daily-bites-3',    'Log 3 meals',            'Breakfast, lunch, dinner - capture them all.',    'BITES_LOGGED',       3, 30),
  ('daily-place-bite', 'Log a meal at a place',  'Eating out or grabbing a snack? Tag the spot.',   'PLACE_BITES_LOGGED', 1, 25),
  ('daily-review',     'Post a review',          'Turn a great meal into a full review.',           'REVIEWS_POSTED',     1, 40),
  ('daily-likes-3',    'Like 3 posts',           'Spread some love through the feed.',              'LIKES_GIVEN',        3, 10),
  ('daily-comment',    'Leave a comment',        'Tell someone their food pic made you hungry.',    'COMMENTS_POSTED',    1, 10);
