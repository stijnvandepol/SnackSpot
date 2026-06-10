-- Web push (product-vision hoofdstuk 5): subscription storage plus
-- per-category push preferences. Subscribing in the browser is the opt-in;
-- the category toggles default to on for subscribed users and can be
-- switched off individually in the notification settings.

CREATE TABLE push_subscriptions (
  id           TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  user_id      TEXT        NOT NULL,
  endpoint     TEXT        NOT NULL,
  p256dh       TEXT        NOT NULL,
  auth         TEXT        NOT NULL,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,

  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX push_subscriptions_user_id_idx ON push_subscriptions (user_id);

ALTER TABLE notification_preferences
  ADD COLUMN push_on_like         BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN push_on_comment      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN push_on_mention      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN push_on_badge        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN push_streak_reminder BOOLEAN NOT NULL DEFAULT true;
