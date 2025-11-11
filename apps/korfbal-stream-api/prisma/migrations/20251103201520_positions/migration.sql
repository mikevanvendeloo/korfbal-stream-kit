/*
  Warnings:

  - You are about to drop the column `capabilityId` on the `SegmentRoleAssignment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[productionSegmentId,positionId,personId]` on the table `SegmentRoleAssignment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `positionId` to the `SegmentRoleAssignment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."SegmentRoleAssignment" DROP CONSTRAINT "SegmentRoleAssignment_capabilityId_fkey";

-- DropIndex
DROP INDEX "public"."SegmentRoleAssignment_capabilityId_idx";

-- DropIndex
DROP INDEX "public"."SegmentRoleAssignment_productionSegmentId_capabilityId_pers_key";

-- AlterTable
ALTER TABLE "SegmentRoleAssignment" DROP COLUMN "capabilityId",
ADD COLUMN     "positionId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Position" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Position_name_key" ON "Position"("name");

-- CreateIndex
CREATE INDEX "SegmentRoleAssignment_positionId_idx" ON "SegmentRoleAssignment"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "SegmentRoleAssignment_productionSegmentId_positionId_person_key" ON "SegmentRoleAssignment"("productionSegmentId", "positionId", "personId");

-- AddForeignKey
ALTER TABLE "SegmentRoleAssignment" ADD CONSTRAINT "SegmentRoleAssignment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;
