-- RenameForeignKey
ALTER TABLE "MatchRoleAssignment" RENAME CONSTRAINT "MatchRoleAssignment_capabilityId_fkey" TO "MatchRoleAssignment_skillId_fkey";

-- RenameForeignKey
ALTER TABLE "PersonCapability" RENAME CONSTRAINT "PersonCapability_capabilityId_fkey" TO "PersonCapability_skillId_fkey";

-- RenameForeignKey
ALTER TABLE "Position" RENAME CONSTRAINT "Position_capabilityId_fkey" TO "Position_skillId_fkey";
