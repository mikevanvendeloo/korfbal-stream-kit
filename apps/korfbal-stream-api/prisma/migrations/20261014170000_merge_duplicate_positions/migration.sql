-- Merges duplicate positions and skills into one, keeping every reference.
--
-- Duplicates came from two places: code that created a lowercase position ("regie", "camera links", ...)
-- when it couldn't find the exact name, and the seed that added "Showcaller" (skill SHOWCALLER) next to
-- "Show caller" (skill SHOW_CALLER). Positions match when their names are equal ignoring case, spaces
-- and punctuation, or through the aliases below (same list as POSITION_ALIASES in domain/positionSkill.ts).
-- Also cleans a database restored from an older backup, since the migration runs after the restore.

-- ---------------------------------------------------------------- skills
-- SHOWCALLER is the code the seed and the application use
CREATE TEMP TABLE "_skill_merge" AS
SELECT d."id" AS "dupId", k."id" AS "keepId"
FROM "Capability" d
JOIN "Capability" k ON k."code" = 'SHOWCALLER'
WHERE d."code" = 'SHOW_CALLER';

INSERT INTO "PersonCapability" ("personId", "skillId", "createdAt")
SELECT DISTINCT ON (pc."personId") pc."personId", m."keepId", pc."createdAt"
FROM "PersonCapability" pc JOIN "_skill_merge" m ON pc."skillId" = m."dupId"
ON CONFLICT DO NOTHING;
DELETE FROM "PersonCapability" WHERE "skillId" IN (SELECT "dupId" FROM "_skill_merge");

UPDATE "MatchRoleAssignment" a SET "skillId" = m."keepId"
FROM "_skill_merge" m
WHERE a."skillId" = m."dupId"
  AND NOT EXISTS (
    SELECT 1 FROM "MatchRoleAssignment" b
    WHERE b."matchScheduleId" = a."matchScheduleId" AND b."personId" = a."personId" AND b."skillId" = m."keepId"
  );
DELETE FROM "MatchRoleAssignment" WHERE "skillId" IN (SELECT "dupId" FROM "_skill_merge");

UPDATE "Position" p SET "skillId" = m."keepId" FROM "_skill_merge" m WHERE p."skillId" = m."dupId";
DELETE FROM "Capability" WHERE "id" IN (SELECT "dupId" FROM "_skill_merge");

-- ---------------------------------------------------------------- positions
CREATE TEMP TABLE "_position_alias" ("alias" TEXT PRIMARY KEY, "canonical" TEXT NOT NULL);
INSERT INTO "_position_alias" VALUES
  ('overzichtcamera', 'cameraoverzicht'),
  ('regie', 'regielivestream'),
  ('schermregie', 'regieledscherm'),
  ('ledschermregie', 'regieledscherm');

CREATE TEMP TABLE "_position_key" AS
SELECT p."id", p."skillId", lower(regexp_replace(p."name", '[^[:alnum:]]', '', 'g')) AS "key",
  (SELECT count(*) FROM "CallSheetItemPosition" x WHERE x."positionId" = p."id")
  + (SELECT count(*) FROM "CallSheetTemplatePosition" x WHERE x."positionId" = p."id")
  + (SELECT count(*) FROM "ProductionEventPosition" x WHERE x."positionId" = p."id")
  + (SELECT count(*) FROM "ProductionPersonPosition" x WHERE x."positionId" = p."id")
  + (SELECT count(*) FROM "SegmentRoleAssignment" x WHERE x."positionId" = p."id")
  + (SELECT count(*) FROM "SegmentDefaultPosition" x WHERE x."positionId" = p."id") AS "refs"
FROM "Position" p;

-- An alias only counts when its canonical position exists
UPDATE "_position_key" k SET "key" = a."canonical"
FROM "_position_alias" a
WHERE k."key" = a."alias" AND EXISTS (SELECT 1 FROM "_position_key" c WHERE c."key" = a."canonical");

-- Per group keep the most used position, then one with a skill, then the oldest
CREATE TEMP TABLE "_position_merge" AS
SELECT k."id" AS "dupId", w."id" AS "keepId", k."skillId" AS "dupSkillId"
FROM "_position_key" k
JOIN LATERAL (
  SELECT c."id" FROM "_position_key" c WHERE c."key" = k."key"
  ORDER BY c."refs" DESC, (c."skillId" IS NOT NULL) DESC, c."id" ASC LIMIT 1
) w ON TRUE
WHERE w."id" <> k."id";

-- Keep a skill when only the duplicate had one
UPDATE "Position" p SET "skillId" = m."dupSkillId"
FROM "_position_merge" m
WHERE p."id" = m."keepId" AND p."skillId" IS NULL AND m."dupSkillId" IS NOT NULL;

INSERT INTO "CallSheetItemPosition" ("callSheetItemId", "positionId", "createdAt")
SELECT DISTINCT ON (x."callSheetItemId", m."keepId") x."callSheetItemId", m."keepId", x."createdAt"
FROM "CallSheetItemPosition" x JOIN "_position_merge" m ON x."positionId" = m."dupId"
ON CONFLICT DO NOTHING;

INSERT INTO "CallSheetTemplatePosition" ("templateItemId", "positionId")
SELECT DISTINCT x."templateItemId", m."keepId"
FROM "CallSheetTemplatePosition" x JOIN "_position_merge" m ON x."positionId" = m."dupId"
ON CONFLICT DO NOTHING;

INSERT INTO "ProductionEventPosition" ("eventId", "positionId")
SELECT DISTINCT x."eventId", m."keepId"
FROM "ProductionEventPosition" x JOIN "_position_merge" m ON x."positionId" = m."dupId"
ON CONFLICT DO NOTHING;

INSERT INTO "ProductionPersonPosition" ("productionId", "personId", "positionId", "createdAt")
SELECT DISTINCT ON (x."productionId", x."personId", m."keepId") x."productionId", x."personId", m."keepId", x."createdAt"
FROM "ProductionPersonPosition" x JOIN "_position_merge" m ON x."positionId" = m."dupId"
ON CONFLICT DO NOTHING;

INSERT INTO "SegmentRoleAssignment" ("productionSegmentId", "personId", "positionId", "createdAt")
SELECT DISTINCT ON (x."productionSegmentId", x."personId", m."keepId") x."productionSegmentId", x."personId", m."keepId", x."createdAt"
FROM "SegmentRoleAssignment" x JOIN "_position_merge" m ON x."positionId" = m."dupId"
ON CONFLICT DO NOTHING;

-- (segmentName, order) stays unique: only the position changes
UPDATE "SegmentDefaultPosition" x SET "positionId" = m."keepId"
FROM "_position_merge" m WHERE x."positionId" = m."dupId";

INSERT INTO "PositionLink" ("sourcePositionId", "targetPositionId")
SELECT DISTINCT coalesce(ms."keepId", l."sourcePositionId"), coalesce(mt."keepId", l."targetPositionId")
FROM "PositionLink" l
LEFT JOIN "_position_merge" ms ON l."sourcePositionId" = ms."dupId"
LEFT JOIN "_position_merge" mt ON l."targetPositionId" = mt."dupId"
WHERE (ms."dupId" IS NOT NULL OR mt."dupId" IS NOT NULL)
  AND coalesce(ms."keepId", l."sourcePositionId") <> coalesce(mt."keepId", l."targetPositionId")
ON CONFLICT DO NOTHING;

-- Removes the duplicates; their remaining rows (now copied to the kept position) cascade
DELETE FROM "Position" WHERE "id" IN (SELECT "dupId" FROM "_position_merge");

DROP TABLE "_position_merge";
DROP TABLE "_position_key";
DROP TABLE "_position_alias";
DROP TABLE "_skill_merge";
