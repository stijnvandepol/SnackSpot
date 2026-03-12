-- Refresh token family detection
-- Adds a 'family' identifier (shared across token rotations from one login session)
-- and 'used_at' to detect when a previously rotated token is re-presented — a strong
-- signal that the token was stolen and used by two parties simultaneously.

ALTER TABLE refresh_tokens ADD COLUMN family TEXT;
ALTER TABLE refresh_tokens ADD COLUMN used_at TIMESTAMPTZ;

-- Back-fill existing tokens: each gets its own unique family so old sessions
-- are isolated from each other but still benefit from detection going forward.
UPDATE refresh_tokens SET family = gen_random_uuid()::TEXT WHERE family IS NULL;

ALTER TABLE refresh_tokens ALTER COLUMN family SET NOT NULL;

-- Index for fast family-wide invalidation on theft detection.
CREATE INDEX IF NOT EXISTS refresh_tokens_family_idx ON refresh_tokens (family);
