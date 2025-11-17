-- CreateTable
CREATE TABLE "CallSheet" (
    "id" SERIAL NOT NULL,
    "productionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSheetItem" (
    "id" TEXT NOT NULL,
    "callSheetId" INTEGER NOT NULL,
    "productionSegmentId" INTEGER NOT NULL,
    "cue" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "color" TEXT,
    "timeStart" TIMESTAMP(3),
    "timeEnd" TIMESTAMP(3),
    "durationSec" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSheetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSheetItemPosition" (
    "callSheetItemId" TEXT NOT NULL,
    "positionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallSheetItemPosition_pkey" PRIMARY KEY ("callSheetItemId","positionId")
);

-- CreateIndex
CREATE INDEX "CallSheet_productionId_idx" ON "CallSheet"("productionId");

-- CreateIndex
CREATE UNIQUE INDEX "CallSheet_productionId_name_key" ON "CallSheet"("productionId", "name");

-- CreateIndex
CREATE INDEX "CallSheetItem_callSheetId_idx" ON "CallSheetItem"("callSheetId");

-- CreateIndex
CREATE INDEX "CallSheetItem_productionSegmentId_idx" ON "CallSheetItem"("productionSegmentId");

-- CreateIndex
CREATE INDEX "CallSheetItemPosition_positionId_idx" ON "CallSheetItemPosition"("positionId");

-- AddForeignKey
ALTER TABLE "CallSheet" ADD CONSTRAINT "CallSheet_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheetItem" ADD CONSTRAINT "CallSheetItem_callSheetId_fkey" FOREIGN KEY ("callSheetId") REFERENCES "CallSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheetItem" ADD CONSTRAINT "CallSheetItem_productionSegmentId_fkey" FOREIGN KEY ("productionSegmentId") REFERENCES "ProductionSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheetItemPosition" ADD CONSTRAINT "CallSheetItemPosition_callSheetItemId_fkey" FOREIGN KEY ("callSheetItemId") REFERENCES "CallSheetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheetItemPosition" ADD CONSTRAINT "CallSheetItemPosition_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;
