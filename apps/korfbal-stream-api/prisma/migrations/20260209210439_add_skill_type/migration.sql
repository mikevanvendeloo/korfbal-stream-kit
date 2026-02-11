-- CreateEnum
CREATE TYPE "SkillType" AS ENUM ('crew', 'on_stream');

-- AlterTable
ALTER TABLE "Capability" ADD COLUMN     "type" "SkillType" NOT NULL DEFAULT 'crew';
