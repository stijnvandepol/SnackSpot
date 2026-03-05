CREATE TABLE review_likes (
  user_id    TEXT        NOT NULL,
  review_id  TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT review_likes_pkey PRIMARY KEY (user_id, review_id),
  CONSTRAINT review_likes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT review_likes_review_id_fkey
    FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE
);

CREATE INDEX review_likes_review_id_created_at_idx ON review_likes (review_id, created_at DESC);
