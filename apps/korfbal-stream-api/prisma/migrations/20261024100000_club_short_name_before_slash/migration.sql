-- Clubs are global, so no organization filter. The slug stays as it is (photos and logos live under it).

-- 1. The short name of a club is the part before the first '/' ("Fortuna/Ruitenheer" -> "Fortuna").
UPDATE "Club"
SET "shortName" = trim(split_part("shortName", '/', 1))
WHERE "shortName" LIKE '%/%'
  AND trim(split_part("shortName", '/', 1)) <> '';

-- 2. Abbreviation for logos and the LED screen ("FOR", "DOS", "KZ").
ALTER TABLE "Club" ADD COLUMN "abbreviation" TEXT;

-- Same rule as clubAbbreviation() in src/utils/clubs.ts: the uppercase letters/digits of the part before
-- the '/', max 3; several words that all start with a letter give the initials ("Koog Zaandijk" -> "KZ").
WITH words AS (
  SELECT c."id",
         array_remove(regexp_split_to_array(upper(trim(split_part(c."shortName", '/', 1))), '[^A-Z0-9]+'), '') AS w
  FROM "Club" c
)
UPDATE "Club" c
SET "abbreviation" = NULLIF(left(
  CASE
    WHEN cardinality(words.w) > 1 AND NOT EXISTS (SELECT 1 FROM unnest(words.w) AS x WHERE x !~ '^[A-Z]')
      THEN (SELECT string_agg(left(x, 1), '' ORDER BY i) FROM unnest(words.w) WITH ORDINALITY AS t(x, i))
    ELSE array_to_string(words.w, '')
  END, 3), '')
FROM words
WHERE words."id" = c."id";
