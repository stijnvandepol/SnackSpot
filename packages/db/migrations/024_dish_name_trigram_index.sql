-- Enable pg_trgm so ILIKE queries on dish_name can use a GIN trigram index.
-- This accelerates the ILIKE fallback path in place-search.ts for short search
-- terms that don't match plainto_tsquery (single characters, symbols, etc.).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_reviews_dish_name_trgm
  ON reviews USING GIN (dish_name gin_trgm_ops)
  WHERE dish_name IS NOT NULL;
