-- Allow half-star ratings (0.5 increments) across all review rating columns.
ALTER TABLE reviews
  ALTER COLUMN rating TYPE NUMERIC(2,1) USING rating::numeric,
  ALTER COLUMN rating_taste TYPE NUMERIC(2,1) USING rating_taste::numeric,
  ALTER COLUMN rating_value TYPE NUMERIC(2,1) USING rating_value::numeric,
  ALTER COLUMN rating_portion TYPE NUMERIC(2,1) USING rating_portion::numeric,
  ALTER COLUMN rating_service TYPE NUMERIC(2,1) USING rating_service::numeric;

ALTER TABLE reviews
  DROP CONSTRAINT IF EXISTS reviews_rating_check,
  DROP CONSTRAINT IF EXISTS reviews_rating_taste_range,
  DROP CONSTRAINT IF EXISTS reviews_rating_value_range,
  DROP CONSTRAINT IF EXISTS reviews_rating_portion_range,
  DROP CONSTRAINT IF EXISTS reviews_rating_service_range;

ALTER TABLE reviews
  ADD CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1.0 AND 5.0),
  ADD CONSTRAINT reviews_rating_step CHECK ((rating * 2) = trunc(rating * 2)),
  ADD CONSTRAINT reviews_rating_taste_range CHECK (rating_taste BETWEEN 1.0 AND 5.0),
  ADD CONSTRAINT reviews_rating_taste_step CHECK ((rating_taste * 2) = trunc(rating_taste * 2)),
  ADD CONSTRAINT reviews_rating_value_range CHECK (rating_value BETWEEN 1.0 AND 5.0),
  ADD CONSTRAINT reviews_rating_value_step CHECK ((rating_value * 2) = trunc(rating_value * 2)),
  ADD CONSTRAINT reviews_rating_portion_range CHECK (rating_portion BETWEEN 1.0 AND 5.0),
  ADD CONSTRAINT reviews_rating_portion_step CHECK ((rating_portion * 2) = trunc(rating_portion * 2)),
  ADD CONSTRAINT reviews_rating_service_range CHECK (rating_service IS NULL OR (rating_service BETWEEN 1.0 AND 5.0)),
  ADD CONSTRAINT reviews_rating_service_step CHECK (rating_service IS NULL OR ((rating_service * 2) = trunc(rating_service * 2)));
