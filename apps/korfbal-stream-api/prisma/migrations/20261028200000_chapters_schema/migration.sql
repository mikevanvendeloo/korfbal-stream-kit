-- Hoofdstukken (openspec/changes/chapters, phase 1): additive only. ProductionSegment and
-- SegmentRoleAssignment keep their tables; Prisma calls them ProductionChapter and ChapterRoleAssignment.
-- AlterTable
ALTER TABLE "Production" ADD COLUMN     "chaptersAutoPlaced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CallSheetTemplate" ADD COLUMN     "chaptersAutoPlaced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CallSheetTemplateItem" ADD COLUMN     "chapterId" TEXT;

-- AlterTable
ALTER TABLE "ProductionEvent" ADD COLUMN     "chapterId" INTEGER;

-- CreateTable
CREATE TABLE "CallSheetTemplateChapter" (
    "id" TEXT NOT NULL,
    "templateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL DEFAULT missing_organization_id(),

    CONSTRAINT "CallSheetTemplateChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSheetTemplateChapterPosition" (
    "chapterId" TEXT NOT NULL,
    "positionId" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL DEFAULT missing_organization_id(),

    CONSTRAINT "CallSheetTemplateChapterPosition_pkey" PRIMARY KEY ("chapterId","orderIndex")
);

-- CreateIndex
CREATE INDEX "CallSheetTemplateChapter_templateId_idx" ON "CallSheetTemplateChapter"("templateId");

-- CreateIndex
CREATE INDEX "CallSheetTemplateChapter_organizationId_idx" ON "CallSheetTemplateChapter"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CallSheetTemplateChapter_templateId_orderIndex_key" ON "CallSheetTemplateChapter"("templateId", "orderIndex");

-- CreateIndex
CREATE INDEX "CallSheetTemplateChapterPosition_positionId_idx" ON "CallSheetTemplateChapterPosition"("positionId");

-- CreateIndex
CREATE INDEX "CallSheetTemplateChapterPosition_organizationId_idx" ON "CallSheetTemplateChapterPosition"("organizationId");

-- CreateIndex
CREATE INDEX "CallSheetTemplateItem_chapterId_idx" ON "CallSheetTemplateItem"("chapterId");

-- CreateIndex
CREATE INDEX "ProductionEvent_chapterId_idx" ON "ProductionEvent"("chapterId");

-- AddForeignKey
ALTER TABLE "CallSheetTemplateChapter" ADD CONSTRAINT "CallSheetTemplateChapter_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CallSheetTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheetTemplateChapter" ADD CONSTRAINT "CallSheetTemplateChapter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheetTemplateChapterPosition" ADD CONSTRAINT "CallSheetTemplateChapterPosition_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "CallSheetTemplateChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheetTemplateChapterPosition" ADD CONSTRAINT "CallSheetTemplateChapterPosition_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheetTemplateChapterPosition" ADD CONSTRAINT "CallSheetTemplateChapterPosition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheetTemplateItem" ADD CONSTRAINT "CallSheetTemplateItem_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "CallSheetTemplateChapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEvent" ADD CONSTRAINT "ProductionEvent_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "ProductionSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A row may only point at rows of its own organization (enforce_same_organization, see 20261015200000_organizations).
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "CallSheetTemplateChapter" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('CallSheetTemplate', 'templateId');
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "CallSheetTemplateChapterPosition" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('CallSheetTemplateChapter', 'chapterId', 'Position', 'positionId');
DROP TRIGGER same_organization ON "CallSheetTemplateItem";
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "CallSheetTemplateItem" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('CallSheetTemplate', 'templateId', 'CallSheetTemplateItem', 'parentId', 'CallSheetTemplateChapter', 'chapterId');
DROP TRIGGER same_organization ON "ProductionEvent";
CREATE TRIGGER same_organization BEFORE INSERT OR UPDATE ON "ProductionEvent" FOR EACH ROW
  EXECUTE FUNCTION enforce_same_organization('Production', 'productionId', 'ProductionEvent', 'parentId', 'CallSheetItem', 'callSheetItemId', 'ProductionSegment', 'chapterId');
