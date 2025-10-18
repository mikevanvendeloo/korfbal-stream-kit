/*
  Warnings:

  - A unique constraint covering the columns `[matchScheduleId,capabilityId,personId]` on the table `MatchRoleAssignment` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."MatchRoleAssignment_matchScheduleId_capabilityId_key";

-- AlterTable
ALTER TABLE "Capability" ADD COLUMN     "functionName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MatchRoleAssignment_matchScheduleId_capabilityId_personId_key" ON "MatchRoleAssignment"("matchScheduleId", "capabilityId", "personId");
