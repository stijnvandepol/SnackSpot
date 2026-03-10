CREATE TABLE IF NOT EXISTS review_tags (
  review_id   TEXT        NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  tag         TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (review_id, tag)
);

CREATE INDEX IF NOT EXISTS review_tags_tag_created_at_idx
  ON review_tags (tag, created_at DESC);
