-- Organizations (multi-tenant step 1, see openspec/changes/organizations/design.md).
-- Every tenant table gets organizationId; all existing data and per-organization settings move to Fortuna.

-- Default for organizationId: inserting without an organization fails loudly instead of landing nowhere.
-- The Prisma extension (services/prisma.ts) always sets it, so this only fires for code that bypasses it.
CREATE FUNCTION missing_organization_id() RETURNS INTEGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'organizationId is required: run the query inside runWithOrganization()'
    USING ERRCODE = 'not_null_violation';
END;
$$;

-- CreateTable
CREATE TABLE "Organization" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "clubId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fortuna, linked to its club: the configured own club, otherwise a club whose slug starts with "fortuna"
INSERT INTO "Organization" ("slug", "name", "clubId")
VALUES ('fortuna', 'Fortuna', COALESCE(
  (SELECT c."id" FROM "Club" c JOIN "Setting" s ON s."key" = 'ownClubId' AND jsonb_typeof(s."value") = 'number' AND c."id" = (s."value")::text::int),
  (SELECT c."id" FROM "Club" c WHERE c."slug" ILIKE 'fortuna%' ORDER BY c."id" LIMIT 1)
));
INSERT INTO "Organization" ("slug", "name") VALUES ('knkv', 'KNKV');

-- organizationId on every tenant table: existing rows belong to Fortuna
DO $$
DECLARE
  t TEXT;
  fortuna INTEGER := (SELECT "id" FROM "Organization" WHERE "slug" = 'fortuna');
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Sponsor', 'MatchSchedule', 'Capability', 'Position', 'PositionLink', 'Person', 'PersonCapability',
    'MatchRoleAssignment', 'Production', 'CallSheetTemplate', 'CallSheetTemplateItem', 'CallSheetTemplatePosition',
    'ProductionPerson', 'ProductionPersonPosition', 'ProductionSegment', 'SegmentTemplate', 'SegmentTemplateItem',
    'SegmentDefaultPosition', 'SegmentRoleAssignment', 'TitleDefinition', 'TitlePart', 'InterviewSubject',
    'CallSheet', 'CallSheetItem', 'CallSheetItemPosition', 'ProductionReport', 'ProductionEvent',
    'ProductionEventPosition'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN "organizationId" INTEGER', t);
    EXECUTE format('UPDATE %I SET "organizationId" = %s', t, fortuna);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "organizationId" SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "organizationId" SET DEFAULT missing_organization_id()', t);
    EXECUTE format('CREATE INDEX %I ON %I ("organizationId")', t || '_organizationId_idx', t);
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      t, t || '_organizationId_fkey');
  END LOOP;
END;
$$;

-- Unique per organization
DROP INDEX "CallSheetTemplate_name_key";
DROP INDEX "Capability_code_key";
DROP INDEX "MatchSchedule_externalId_key";
DROP INDEX "Position_name_key";
DROP INDEX "SegmentDefaultPosition_segmentName_order_key";
DROP INDEX "SegmentTemplate_name_key";
CREATE UNIQUE INDEX "CallSheetTemplate_organizationId_name_key" ON "CallSheetTemplate"("organizationId", "name");
CREATE UNIQUE INDEX "Capability_organizationId_code_key" ON "Capability"("organizationId", "code");
CREATE UNIQUE INDEX "MatchSchedule_organizationId_externalId_key" ON "MatchSchedule"("organizationId", "externalId");
CREATE UNIQUE INDEX "Position_organizationId_name_key" ON "Position"("organizationId", "name");
CREATE UNIQUE INDEX "SegmentDefaultPosition_organizationId_segmentName_order_key" ON "SegmentDefaultPosition"("organizationId", "segmentName", "order");
CREATE UNIQUE INDEX "SegmentTemplate_organizationId_name_key" ON "SegmentTemplate"("organizationId", "name");

-- CreateTable
CREATE TABLE "OrganizationSetting" (
    "organizationId" INTEGER NOT NULL DEFAULT missing_organization_id(),
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationSetting_pkey" PRIMARY KEY ("organizationId","key")
);
ALTER TABLE "OrganizationSetting" ADD CONSTRAINT "OrganizationSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "MatchSource" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL DEFAULT missing_organization_id(),
    "provider" TEXT NOT NULL DEFAULT 'vrijwilligers',
    "baseUrl" TEXT NOT NULL,
    "apiToken" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MatchSource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MatchSource_organizationId_key" ON "MatchSource"("organizationId");
ALTER TABLE "MatchSource" ADD CONSTRAINT "MatchSource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "OrganizationApiKey" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL DEFAULT missing_organization_id(),
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "OrganizationApiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationApiKey_keyHash_key" ON "OrganizationApiKey"("keyHash");
CREATE INDEX "OrganizationApiKey_organizationId_idx" ON "OrganizationApiKey"("organizationId");
ALTER TABLE "OrganizationApiKey" ADD CONSTRAINT "OrganizationApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Settings: everything except the installation-wide active season belongs to Fortuna now
INSERT INTO "OrganizationSetting" ("organizationId", "key", "value", "createdAt", "updatedAt")
SELECT (SELECT "id" FROM "Organization" WHERE "slug" = 'fortuna'), "key", "value", "createdAt", "updatedAt"
FROM "Setting" WHERE "key" <> 'activeSeasonId';
DELETE FROM "Setting" WHERE "key" <> 'activeSeasonId';

-- The extra entry the sponsor carousel always showed, now Fortuna configuration instead of code
INSERT INTO "OrganizationSetting" ("organizationId", "key", "value", "updatedAt")
SELECT "id", 'sponsorCarouselExtra',
  '{"name": "Fortuna sponsor", "logoUrl": "sponsoring.png", "type": "premium", "websiteUrl": "https://www.fortuna-korfbal.nl/sponsoring/businessclub/"}'::jsonb,
  CURRENT_TIMESTAMP
FROM "Organization" WHERE "slug" = 'fortuna'
ON CONFLICT DO NOTHING;

-- A row may only point at rows of its own organization. The Prisma extension scopes queries, but ids
-- in request bodies (positionId, personId, ...) are written as given: this trigger refuses a foreign one.
-- Arguments: pairs of (parent table, foreign key column).
CREATE FUNCTION enforce_same_organization() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  i INTEGER := 0;
  parent_organization INTEGER;
BEGIN
  WHILE i < TG_NARGS LOOP
    EXECUTE format('SELECT p."organizationId" FROM %I p WHERE p."id" = ($1).%I', TG_ARGV[i], TG_ARGV[i + 1])
      INTO parent_organization USING NEW;
    -- NULL: no reference, or a missing parent (the foreign key constraint reports that)
    IF parent_organization IS NOT NULL AND parent_organization <> NEW."organizationId" THEN
      RAISE EXCEPTION '%.% refers to a row of another organization', TG_TABLE_NAME, TG_ARGV[i + 1]
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    i := i + 2;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "PositionLink" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('Position', 'sourcePositionId', 'Position', 'targetPositionId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "PersonCapability" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('Person', 'personId', 'Capability', 'skillId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "MatchRoleAssignment" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('MatchSchedule', 'matchScheduleId', 'Person', 'personId', 'Capability', 'skillId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "Production" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('MatchSchedule', 'matchScheduleId', 'CallSheetTemplate', 'callSheetTemplateId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "Position" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('Capability', 'skillId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "CallSheetTemplateItem" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('CallSheetTemplate', 'templateId', 'CallSheetTemplateItem', 'parentId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "CallSheetTemplatePosition" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('CallSheetTemplateItem', 'templateItemId', 'Position', 'positionId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "ProductionPerson" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('Production', 'productionId', 'Person', 'personId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "ProductionPersonPosition" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('Production', 'productionId', 'Person', 'personId', 'Position', 'positionId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "ProductionSegment" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('Production', 'productionId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "SegmentTemplateItem" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('SegmentTemplate', 'templateId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "SegmentDefaultPosition" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('Position', 'positionId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "SegmentRoleAssignment" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('ProductionSegment', 'productionSegmentId', 'Person', 'personId', 'Position', 'positionId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "TitleDefinition" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('Production', 'productionId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "TitlePart" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('TitleDefinition', 'titleDefinitionId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "InterviewSubject" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('Production', 'productionId', 'TitleDefinition', 'titleDefinitionId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "CallSheet" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('Production', 'productionId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "CallSheetItem" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('CallSheet', 'callSheetId', 'ProductionSegment', 'productionSegmentId', 'CallSheetItem', 'parentId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "CallSheetItemPosition" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('CallSheetItem', 'callSheetItemId', 'Position', 'positionId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "ProductionReport" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('Production', 'productionId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "ProductionEvent" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('Production', 'productionId', 'ProductionEvent', 'parentId', 'CallSheetItem', 'callSheetItemId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "ProductionEventPosition" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('ProductionEvent', 'eventId', 'Position', 'positionId');
