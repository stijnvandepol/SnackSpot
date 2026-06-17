-- Google SSO: allow password-less accounts and link external identities.

-- Google-authenticated users have no password.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- One row per (provider, external account) -> internal user.
CREATE TABLE accounts (
  id                  TEXT        PRIMARY KEY,
  user_id             TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider            TEXT        NOT NULL,
  provider_account_id TEXT        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX accounts_provider_account_id_key
  ON accounts (provider, provider_account_id);
CREATE INDEX accounts_user_id_idx ON accounts (user_id);
