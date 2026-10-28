-- Hoofdstukken, phase 5 (openspec/changes/chapters D8): every item is in a hoofdstuk, segment templates
-- and the standard positions per segment name are gone, a hoofdstuk has no duration or anchor of its own.

-- 1. Items still without a hoofdstuk (the startup migration of phase 2 normally placed them all).
--    A linked item first takes the hoofdstuk of its parent.
UPDATE "CallSheetItem" i SET "productionSegmentId" = p."productionSegmentId"
FROM "CallSheetItem" p
WHERE i."productionSegmentId" IS NULL AND i."parentId" = p."id" AND p."organizationId" = i."organizationId"
  AND p."productionSegmentId" IS NOT NULL;

UPDATE "CallSheetTemplateItem" i SET "chapterId" = p."chapterId"
FROM "CallSheetTemplateItem" p
WHERE i."chapterId" IS NULL AND i."parentId" = p."id" AND p."organizationId" = i."organizationId"
  AND p."chapterId" IS NOT NULL;

--    The rest goes into a new hoofdstuk "Draaiboek" at the end of its production or template, marked for checking.
INSERT INTO "ProductionSegment" ("productionId", "naam", "volgorde", "duurInMinuten", "isTimeAnchor", "organizationId")
SELECT pr."id", 'Draaiboek',
       COALESCE((SELECT MAX(s."volgorde") FROM "ProductionSegment" s WHERE s."productionId" = pr."id" AND s."organizationId" = pr."organizationId"), 0) + 1,
       0, false, pr."organizationId"
FROM "Production" pr
WHERE EXISTS (
  SELECT 1 FROM "CallSheetItem" i JOIN "CallSheet" c ON c."id" = i."callSheetId" AND c."organizationId" = i."organizationId"
  WHERE c."productionId" = pr."id" AND c."organizationId" = pr."organizationId" AND i."productionSegmentId" IS NULL
);

UPDATE "Production" pr SET "chaptersAutoPlaced" = true
WHERE EXISTS (
  SELECT 1 FROM "CallSheetItem" i JOIN "CallSheet" c ON c."id" = i."callSheetId" AND c."organizationId" = i."organizationId"
  WHERE c."productionId" = pr."id" AND c."organizationId" = pr."organizationId" AND i."productionSegmentId" IS NULL
);

UPDATE "CallSheetItem" i SET "productionSegmentId" = s."id"
FROM "CallSheet" c, "ProductionSegment" s
WHERE i."productionSegmentId" IS NULL
  AND c."id" = i."callSheetId" AND c."organizationId" = i."organizationId"
  AND s."productionId" = c."productionId" AND s."organizationId" = c."organizationId"
  AND s."volgorde" = (SELECT MAX(s2."volgorde") FROM "ProductionSegment" s2 WHERE s2."productionId" = c."productionId" AND s2."organizationId" = c."organizationId");

INSERT INTO "CallSheetTemplateChapter" ("id", "templateId", "name", "orderIndex", "organizationId")
SELECT gen_random_uuid()::text, t."id", 'Draaiboek',
       COALESCE((SELECT MAX(ch."orderIndex") FROM "CallSheetTemplateChapter" ch WHERE ch."templateId" = t."id" AND ch."organizationId" = t."organizationId"), -1) + 1,
       t."organizationId"
FROM "CallSheetTemplate" t
WHERE EXISTS (SELECT 1 FROM "CallSheetTemplateItem" i WHERE i."templateId" = t."id" AND i."organizationId" = t."organizationId" AND i."chapterId" IS NULL);

UPDATE "CallSheetTemplate" t SET "chaptersAutoPlaced" = true
WHERE EXISTS (SELECT 1 FROM "CallSheetTemplateItem" i WHERE i."templateId" = t."id" AND i."organizationId" = t."organizationId" AND i."chapterId" IS NULL);

UPDATE "CallSheetTemplateItem" i SET "chapterId" = ch."id"
FROM "CallSheetTemplateChapter" ch
WHERE i."chapterId" IS NULL AND ch."templateId" = i."templateId" AND ch."organizationId" = i."organizationId"
  AND ch."orderIndex" = (SELECT MAX(c2."orderIndex") FROM "CallSheetTemplateChapter" c2 WHERE c2."templateId" = i."templateId" AND c2."organizationId" = i."organizationId");

-- 2. Required hoofdstuk; deleting a hoofdstuk takes its items (the API refuses a non-empty one, 409)
ALTER TABLE "CallSheetItem" ALTER COLUMN "productionSegmentId" SET NOT NULL;
ALTER TABLE "CallSheetTemplateItem" ALTER COLUMN "chapterId" SET NOT NULL;
ALTER TABLE "CallSheetTemplateItem" DROP CONSTRAINT "CallSheetTemplateItem_chapterId_fkey";
ALTER TABLE "CallSheetTemplateItem" ADD CONSTRAINT "CallSheetTemplateItem_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "CallSheetTemplateChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. A hoofdstuk's times follow from its items
ALTER TABLE "ProductionSegment" DROP COLUMN "duurInMinuten",
DROP COLUMN "isTimeAnchor";

-- 4. Segment templates and the standard positions per segment name (now on the draaiboek template's hoofdstukken)
DROP TABLE "SegmentDefaultPosition";
DROP TABLE "SegmentTemplateItem";
DROP TABLE "SegmentTemplate";
