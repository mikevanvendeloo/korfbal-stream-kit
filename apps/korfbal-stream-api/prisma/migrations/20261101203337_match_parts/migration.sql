-- AlterTable
ALTER TABLE "CallSheetItem" ADD COLUMN     "isMatchPart" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showVenueClock" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CallSheetTemplateItem" ADD COLUMN     "isMatchPart" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showVenueClock" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProductionEvent" ADD COLUMN     "isMatchPart" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showVenueClock" BOOLEAN NOT NULL DEFAULT false;
