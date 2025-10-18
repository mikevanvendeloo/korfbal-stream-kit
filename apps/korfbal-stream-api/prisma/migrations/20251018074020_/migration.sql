/*
  Warnings:

  - You are about to drop the column `productionFunctionId` on the `MatchRoleAssignment` table. All the data in the column will be lost.
  - The primary key for the `PersonCapability` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `productionFunctionId` on the `PersonCapability` table. All the data in the column will be lost.
  - You are about to drop the `ProductionFunction` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[matchScheduleId,capabilityId]` on the table `MatchRoleAssignment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `capabilityId` to the `MatchRoleAssignment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `capabilityId` to the `PersonCapability` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."MatchRoleAssignment" DROP CONSTRAINT "MatchRoleAssignment_productionFunctionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PersonCapability" DROP CONSTRAINT "PersonCapability_productionFunctionId_fkey";

-- DropIndex
DROP INDEX "public"."MatchRoleAssignment_matchScheduleId_productionFunctionId_key";

-- DropIndex
DROP INDEX "public"."MatchRoleAssignment_productionFunctionId_idx";

-- AlterTable
ALTER TABLE "MatchRoleAssignment" DROP COLUMN "productionFunctionId",
ADD COLUMN     "capabilityId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "PersonCapability" DROP CONSTRAINT "PersonCapability_pkey",
DROP COLUMN "productionFunctionId",
ADD COLUMN     "capabilityId" INTEGER NOT NULL,
ADD CONSTRAINT "PersonCapability_pkey" PRIMARY KEY ("personId", "capabilityId");

-- DropTable
DROP TABLE "public"."ProductionFunction";

-- CreateTable
CREATE TABLE "Capability" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameMale" TEXT NOT NULL,
    "nameFemale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Capability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Production" (
    "id" SERIAL NOT NULL,
    "matchScheduleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Production_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Capability_code_key" ON "Capability"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Production_matchScheduleId_key" ON "Production"("matchScheduleId");

-- CreateIndex
CREATE INDEX "MatchRoleAssignment_capabilityId_idx" ON "MatchRoleAssignment"("capabilityId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchRoleAssignment_matchScheduleId_capabilityId_key" ON "MatchRoleAssignment"("matchScheduleId", "capabilityId");

-- AddForeignKey
ALTER TABLE "PersonCapability" ADD CONSTRAINT "PersonCapability_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "Capability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRoleAssignment" ADD CONSTRAINT "MatchRoleAssignment_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "Capability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_matchScheduleId_fkey" FOREIGN KEY ("matchScheduleId") REFERENCES "MatchSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
