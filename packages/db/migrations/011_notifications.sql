-- Migration 011: Notifications System
-- Add notification types, preferences, mentions, and push subscriptions

CREATE TYPE notification_type AS ENUM (
  'REVIEW_LIKE',
  'REVIEW_COMMENT',
  'REVIEW_MENTION',
  'COMMENT_MENTION',
  'BADGE_EARNED'
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  review_id TEXT REFERENCES reviews(id) ON DELETE CASCADE,
  comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

CREATE TABLE notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_on_like BOOLEAN NOT NULL DEFAULT true,
  email_on_comment BOOLEAN NOT NULL DEFAULT true,
  email_on_mention BOOLEAN NOT NULL DEFAULT true,
  email_on_badge BOOLEAN NOT NULL DEFAULT true,
  push_on_like BOOLEAN NOT NULL DEFAULT true,
  push_on_comment BOOLEAN NOT NULL DEFAULT true,
  push_on_mention BOOLEAN NOT NULL DEFAULT true,
  push_on_badge BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE review_mentions (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  mentioned_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentioned_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(review_id, mentioned_user_id)
);

CREATE INDEX idx_review_mentions_user ON review_mentions(mentioned_user_id, created_at DESC);

CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Create default notification preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;
