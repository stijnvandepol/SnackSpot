-- Functional indexes for case-insensitive username/email lookups.
-- The app resolves users with `{ equals: x, mode: 'insensitive' }` (profile
-- pages, follow, mentions, login, register, exists-checks), which Prisma emits
-- as ILIKE/LOWER() comparisons. The unique B-tree indexes on username/email are
-- case-sensitive and cannot serve these, so without a LOWER() index every such
-- lookup is a sequential scan. These are the hottest read paths (every profile
-- visit and every auth attempt).

CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_email_lower    ON users (LOWER(email));
