-- AlterTable
ALTER TABLE "Production" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProductionSegment" (
    "id" SERIAL NOT NULL,
    "productionId" INTEGER NOT NULL,
    "naam" TEXT NOT NULL,
    "volgorde" INTEGER NOT NULL,
    "duurInMinuten" INTEGER NOT NULL,
    "isTimeAnchor" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProductionSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SegmentRoleAssignment" (
    "id" SERIAL NOT NULL,
    "productionSegmentId" INTEGER NOT NULL,
    "personId" INTEGER NOT NULL,
    "capabilityId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SegmentRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionSegment_productionId_idx" ON "ProductionSegment"("productionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionSegment_productionId_volgorde_key" ON "ProductionSegment"("productionId", "volgorde");

-- CreateIndex
CREATE INDEX "SegmentRoleAssignment_productionSegmentId_idx" ON "SegmentRoleAssignment"("productionSegmentId");

-- CreateIndex
CREATE INDEX "SegmentRoleAssignment_personId_idx" ON "SegmentRoleAssignment"("personId");

-- CreateIndex
CREATE INDEX "SegmentRoleAssignment_capabilityId_idx" ON "SegmentRoleAssignment"("capabilityId");

-- CreateIndex
CREATE UNIQUE INDEX "SegmentRoleAssignment_productionSegmentId_capabilityId_pers_key" ON "SegmentRoleAssignment"("productionSegmentId", "capabilityId", "personId");

-- AddForeignKey
ALTER TABLE "ProductionSegment" ADD CONSTRAINT "ProductionSegment_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentRoleAssignment" ADD CONSTRAINT "SegmentRoleAssignment_productionSegmentId_fkey" FOREIGN KEY ("productionSegmentId") REFERENCES "ProductionSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentRoleAssignment" ADD CONSTRAINT "SegmentRoleAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentRoleAssignment" ADD CONSTRAINT "SegmentRoleAssignment_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "Capability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
