-- AlterTable
ALTER TABLE "Position" ADD COLUMN     "capabilityId" INTEGER;

-- CreateTable
CREATE TABLE "SegmentDefaultPosition" (
    "id" SERIAL NOT NULL,
    "segmentName" TEXT NOT NULL,
    "positionId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "SegmentDefaultPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SegmentDefaultPosition_segmentName_idx" ON "SegmentDefaultPosition"("segmentName");

-- CreateIndex
CREATE INDEX "SegmentDefaultPosition_positionId_idx" ON "SegmentDefaultPosition"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "SegmentDefaultPosition_segmentName_order_key" ON "SegmentDefaultPosition"("segmentName", "order");

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "Capability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentDefaultPosition" ADD CONSTRAINT "SegmentDefaultPosition_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;
