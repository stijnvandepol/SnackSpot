-- Only email_on_comment defaults to true; all other email notifications default to off.
-- Backfill existing rows: since the settings page was broken (preferences were never
-- successfully saved), all existing rows reflect the old "all true" defaults and can
-- safely be reset to the new defaults.

ALTER TABLE notification_preferences
  ALTER COLUMN email_on_like    SET DEFAULT false,
  ALTER COLUMN email_on_mention SET DEFAULT false,
  ALTER COLUMN email_on_badge   SET DEFAULT false;

UPDATE notification_preferences
SET
  email_on_like    = false,
  email_on_mention = false,
  email_on_badge   = false;
