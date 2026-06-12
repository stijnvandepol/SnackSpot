-- GDPR: erasure, restore window and privacy audit trail.
--
--   reviews.deleted_at          - when the review was soft-deleted; a daily worker
--                                 job hard-purges rows older than the 30-day
--                                 restore window (GDPR Art. 17 erasure)
--   reviews.deleted_by_user_id  - who performed the soft delete. Self-deleted
--                                 reviews are restorable by the owner within the
--                                 window; moderator-deleted reviews are not.
--
-- privacy_audit_log records privacy-sensitive actions (account deletion, data
-- export, photo deletion, review purge) for accountability (Art. 5(2)). It has
-- deliberately NO foreign key to users: entries must survive account erasure.
-- Only the opaque user id is stored - never email or username - so after
-- erasure the log is no longer linkable to a natural person.

ALTER TABLE reviews
  ADD COLUMN deleted_at         TIMESTAMPTZ,
  ADD COLUMN deleted_by_user_id TEXT;

-- Existing soft-deleted rows: start a fresh 30-day window and treat them as
-- self-deleted (deletion has been self-service only so far).
UPDATE reviews
SET deleted_at = NOW(), deleted_by_user_id = user_id
WHERE status = 'DELETED' AND deleted_at IS NULL;

-- Purge job scans only soft-deleted rows; a partial index keeps it cheap.
CREATE INDEX idx_reviews_deleted_at
  ON reviews (deleted_at)
  WHERE status = 'DELETED';

CREATE TABLE privacy_audit_log (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT        NOT NULL,
  action     TEXT        NOT NULL,
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_privacy_audit_log_user
  ON privacy_audit_log (user_id, created_at DESC);

CREATE INDEX idx_privacy_audit_log_action
  ON privacy_audit_log (action, created_at DESC);
