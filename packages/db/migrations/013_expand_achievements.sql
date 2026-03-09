DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'BadgeCriteriaType' AND e.enumlabel = 'COMMENTS_RECEIVED_COUNT'
  ) THEN
    ALTER TYPE "BadgeCriteriaType" ADD VALUE 'COMMENTS_RECEIVED_COUNT';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'BadgeCriteriaType' AND e.enumlabel = 'BEST_STREAK_DAYS'
  ) THEN
    ALTER TYPE "BadgeCriteriaType" ADD VALUE 'BEST_STREAK_DAYS';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'BadgeCriteriaType' AND e.enumlabel = 'POSTS_LAST_30_DAYS'
  ) THEN
    ALTER TYPE "BadgeCriteriaType" ADD VALUE 'POSTS_LAST_30_DAYS';
  END IF;
END $$;
