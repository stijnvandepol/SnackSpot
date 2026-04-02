-- Migration 012: Remove push notification infrastructure
-- Push notifications were never fully implemented (no service worker / client subscription flow).
-- Removes the push_subscriptions table and push_on_* columns from notification_preferences.

DROP TABLE IF EXISTS push_subscriptions;

ALTER TABLE notification_preferences
  DROP COLUMN IF EXISTS push_on_like,
  DROP COLUMN IF EXISTS push_on_comment,
  DROP COLUMN IF EXISTS push_on_mention,
  DROP COLUMN IF EXISTS push_on_badge;
