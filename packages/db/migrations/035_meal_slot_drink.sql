-- Bites: add the DRINK meal slot (displayed as "☕ Drink").
--
-- ADD VALUE is allowed inside the migration runner's transaction on PG 12+
-- as long as the new value is not used within the same transaction (it is not).
--
-- Down (manual): enum values cannot be dropped in place; recreate the type
-- without 'DRINK' only if no row uses it.
ALTER TYPE "MealSlot" ADD VALUE IF NOT EXISTS 'DRINK';
