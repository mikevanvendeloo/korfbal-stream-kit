-- AlterTable
ALTER TABLE "CallSheetItem" ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "CallSheetTemplateItem" ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "ProductionEvent" ADD COLUMN     "parentId" TEXT;

-- CreateTable
CREATE TABLE "SegmentTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SegmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SegmentTemplateItem" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "naam" TEXT NOT NULL,
    "volgorde" INTEGER NOT NULL,
    "duurInMinuten" INTEGER NOT NULL,
    "isTimeAnchor" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SegmentTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SegmentTemplate_name_key" ON "SegmentTemplate"("name");

-- CreateIndex
CREATE INDEX "SegmentTemplateItem_templateId_idx" ON "SegmentTemplateItem"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "SegmentTemplateItem_templateId_volgorde_key" ON "SegmentTemplateItem"("templateId", "volgorde");

-- CreateIndex
CREATE INDEX "CallSheetItem_parentId_idx" ON "CallSheetItem"("parentId");

-- CreateIndex
CREATE INDEX "CallSheetTemplateItem_parentId_idx" ON "CallSheetTemplateItem"("parentId");

-- CreateIndex
CREATE INDEX "ProductionEvent_parentId_idx" ON "ProductionEvent"("parentId");

-- AddForeignKey
ALTER TABLE "CallSheetTemplateItem" ADD CONSTRAINT "CallSheetTemplateItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CallSheetTemplateItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentTemplateItem" ADD CONSTRAINT "SegmentTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SegmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheetItem" ADD CONSTRAINT "CallSheetItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CallSheetItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEvent" ADD CONSTRAINT "ProductionEvent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductionEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
