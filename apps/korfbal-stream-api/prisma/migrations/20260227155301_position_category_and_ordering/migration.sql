-- CreateEnum
CREATE TYPE "PositionCategory" AS ENUM ('GENERAL', 'TECHNICAL', 'ENTERTAINMENT');

-- AlterTable
ALTER TABLE "Position" ADD COLUMN     "category" "PositionCategory" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 99;
