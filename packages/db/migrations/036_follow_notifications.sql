-- Followers feature: notify a user when someone starts following them, plus a
-- per-channel preference (email + push) so the alert can be toggled in settings.
--
-- ADD VALUE is allowed inside the migration runner's transaction on PG 12+ as
-- long as the new value is not used within the same transaction. We only add
-- the enum value and two boolean columns here, so nothing references it yet.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'NEW_FOLLOWER';

ALTER TABLE notification_preferences
  ADD COLUMN email_on_follow BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN push_on_follow  BOOLEAN NOT NULL DEFAULT true;
