-- Trigger words that automatically flag comments for admin review
CREATE TABLE blocked_words (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid(),
  word       TEXT        NOT NULL,
  created_by TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT blocked_words_word_unique UNIQUE (word)
);

-- Comments that matched a trigger word and are awaiting admin review
CREATE TABLE flagged_comments (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id   TEXT        NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  matched_word TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'PENDING',
  reviewed_by  TEXT        REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT flagged_comments_comment_unique UNIQUE (comment_id)
);

CREATE INDEX idx_flagged_comments_status ON flagged_comments(status, created_at DESC);
