-- Password reset tokens
-- Stores hashed reset tokens (never plaintext) with expiry and single-use tracking.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         TEXT        NOT NULL DEFAULT (gen_random_uuid()::TEXT),
  user_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);
