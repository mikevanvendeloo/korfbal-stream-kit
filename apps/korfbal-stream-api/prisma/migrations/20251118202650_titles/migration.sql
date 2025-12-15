-- AlterEnum
ALTER TYPE "TitleSourceType" ADD VALUE 'FREE_TEXT';

-- AlterTable
ALTER TABLE "TitlePart" ADD COLUMN     "customFunction" TEXT,
ADD COLUMN     "customName" TEXT;
