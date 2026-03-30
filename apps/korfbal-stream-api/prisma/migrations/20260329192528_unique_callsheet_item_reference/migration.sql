/*
  Warnings:

  - A unique constraint covering the columns `[callSheetItemId]` on the table `ProductionEvent` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "CallSheetItem" ADD COLUMN     "autoAdvance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isInLivestream" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Production" ADD COLUMN     "callSheetTemplateId" INTEGER;

-- AlterTable
ALTER TABLE "ProductionEvent" ADD COLUMN     "anchorType" TEXT,
ADD COLUMN     "autoAdvance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "callSheetItemId" TEXT,
ADD COLUMN     "isInLivestream" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isInVenue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isTimeAnchor" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CallSheetTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSheetTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSheetTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "durationSec" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isInVenue" BOOLEAN NOT NULL DEFAULT false,
    "isInLivestream" BOOLEAN NOT NULL DEFAULT true,
    "isTimeAnchor" BOOLEAN NOT NULL DEFAULT false,
    "anchorType" TEXT,
    "autoAdvance" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSheetTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSheetTemplatePosition" (
    "templateItemId" TEXT NOT NULL,
    "positionId" INTEGER NOT NULL,

    CONSTRAINT "CallSheetTemplatePosition_pkey" PRIMARY KEY ("templateItemId","positionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CallSheetTemplate_name_key" ON "CallSheetTemplate"("name");

-- CreateIndex
CREATE INDEX "CallSheetTemplateItem_templateId_idx" ON "CallSheetTemplateItem"("templateId");

-- CreateIndex
CREATE INDEX "CallSheetTemplatePosition_positionId_idx" ON "CallSheetTemplatePosition"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionEvent_callSheetItemId_key" ON "ProductionEvent"("callSheetItemId");

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_callSheetTemplateId_fkey" FOREIGN KEY ("callSheetTemplateId") REFERENCES "CallSheetTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheetTemplateItem" ADD CONSTRAINT "CallSheetTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CallSheetTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheetTemplatePosition" ADD CONSTRAINT "CallSheetTemplatePosition_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "CallSheetTemplateItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheetTemplatePosition" ADD CONSTRAINT "CallSheetTemplatePosition_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;
