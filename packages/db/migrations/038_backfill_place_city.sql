-- Backfill places.city for rows that never got one.
--
-- Why: /snackbars and /snackbars/[stad] group on places.city (apps/web/lib/city-index.ts),
-- and a place with a NULL city is excluded from its own city page and from the
-- CITY_PAGE_MIN_PLACES / CITY_PAGE_MIN_REVIEWS gate that decides whether the page exists
-- at all. Until now only migration 030's backfill and admin edits ever wrote the column:
-- resolveManualPlace() in apps/web/lib/place-service.ts inserted without it, so every
-- place a user added by hand was permanently invisible to the city pages. That code now
-- derives the city with extractCity(); this migration applies the same rule to the rows
-- that were created before the fix.
--
-- The logic below deliberately mirrors extractCity() in apps/web/lib/utils.ts step for
-- step. If the two ever diverge the same address yields two different city strings, which
-- would split one city into two groups on the landing pages — so keep them in sync.
--
-- Conservative by design: when no rule matches, city stays NULL. A missing place on a city
-- page is a smaller problem than a wrong or duplicated city heading.

DO $do$
DECLARE
  r            RECORD;
  parts        TEXT[];
  candidates   TEXT[];
  part         TEXT;
  m            TEXT[];
  v_city       TEXT;
  updated      INT := 0;
  -- Countries and Dutch provinces, matched case-insensitively. Mirrors SKIP_PARTS.
  -- Note "utrecht" and "groningen" are provinces here as well as cities; that is the
  -- same trade-off the TypeScript parser makes.
  skip_parts   TEXT[] := ARRAY[
    'nederland', 'netherlands', 'the netherlands',
    'belgium', 'belgië', 'belgique',
    'germany', 'duitsland', 'france', 'frankrijk', 'luxembourg', 'luxemburg',
    'noord-holland', 'zuid-holland', 'utrecht', 'noord-brabant', 'gelderland',
    'overijssel', 'friesland', 'fryslân', 'groningen', 'drenthe', 'zeeland',
    'limburg', 'flevoland'
  ];
BEGIN
  FOR r IN
    SELECT id, address
    FROM places
    WHERE (city IS NULL OR btrim(city) = '')
      AND address IS NOT NULL
      AND btrim(address) <> ''
  LOOP
    v_city := NULL;

    -- Split on commas, trim, drop empties.
    SELECT array_agg(p ORDER BY ord)
      INTO parts
      FROM (
        SELECT btrim(value) AS p, ordinality AS ord
        FROM unnest(string_to_array(r.address, ',')) WITH ORDINALITY AS t(value, ordinality)
      ) s
     WHERE s.p <> '';

    CONTINUE WHEN parts IS NULL;

    -- 1. "1234 AB Amsterdam" anywhere in the address wins outright.
    FOREACH part IN ARRAY parts LOOP
      m := regexp_match(part, '^\d{4}\s?[A-Za-z]{2}\s+(.+)$');
      IF m IS NOT NULL THEN
        v_city := btrim(m[1]);
        EXIT;
      END IF;
    END LOOP;

    -- 2. Otherwise drop countries, provinces, bare postal codes and bare house
    --    numbers, then take the second remaining segment (street, then city).
    IF v_city IS NULL THEN
      SELECT array_agg(p ORDER BY ord)
        INTO candidates
        FROM (
          SELECT btrim(value) AS p, ordinality AS ord
          FROM unnest(parts) WITH ORDINALITY AS t(value, ordinality)
        ) s
       WHERE lower(s.p) <> ALL (skip_parts)
         AND s.p !~ '^\d{4}\s?[A-Za-z]{2}$'
         AND s.p !~ '^\d+$';

      IF candidates IS NOT NULL THEN
        IF array_length(candidates, 1) >= 2 THEN
          v_city := candidates[2];
        ELSIF array_length(candidates, 1) = 1 THEN
          -- A lone candidate is only a city if it does not read as a street.
          IF candidates[1] !~ '\d'
             AND candidates[1] !~* '\y(straat|laan|weg|plein|dijk|gracht|kade|steeg|pad|dreef|boulevard|singel|allee)\y'
          THEN
            v_city := candidates[1];
          END IF;
        END IF;
      END IF;
    END IF;

    IF v_city IS NOT NULL AND btrim(v_city) <> '' THEN
      UPDATE places SET city = btrim(v_city) WHERE id = r.id;
      updated := updated + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfilled city for % place(s)', updated;
END
$do$;
