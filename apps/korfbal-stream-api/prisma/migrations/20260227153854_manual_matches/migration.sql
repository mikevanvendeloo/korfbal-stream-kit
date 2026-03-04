-- AlterTable
ALTER TABLE "MatchSchedule" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isManual" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "externalId" DROP NOT NULL;
