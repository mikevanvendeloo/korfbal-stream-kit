-- Rename functionName to name and copy data
ALTER TABLE "Capability" RENAME COLUMN "functionName" TO "name";

-- Drop vMixTitle column
ALTER TABLE "Capability" DROP COLUMN "vMixTitle";

-- Rename capabilityId to skillId in Position table
ALTER TABLE "Position" RENAME COLUMN "capabilityId" TO "skillId";

-- Rename capabilityId to skillId in MatchRoleAssignment table
ALTER TABLE "MatchRoleAssignment" RENAME COLUMN "capabilityId" TO "skillId";

-- Rename capabilityId to skillId in PersonCapability table
ALTER TABLE "PersonCapability" RENAME COLUMN "capabilityId" TO "skillId";

-- Drop existing unique constraint on MatchRoleAssignment
ALTER TABLE "MatchRoleAssignment" DROP CONSTRAINT IF EXISTS "MatchRoleAssignment_matchScheduleId_capabilityId_personId_key";

-- Add new unique constraint with skillId
ALTER TABLE "MatchRoleAssignment" ADD CONSTRAINT "MatchRoleAssignment_matchScheduleId_skillId_personId_key" UNIQUE ("matchScheduleId", "skillId", "personId");

-- Rename index on MatchRoleAssignment
DROP INDEX IF EXISTS "MatchRoleAssignment_capabilityId_idx";
CREATE INDEX "MatchRoleAssignment_skillId_idx" ON "MatchRoleAssignment"("skillId");
