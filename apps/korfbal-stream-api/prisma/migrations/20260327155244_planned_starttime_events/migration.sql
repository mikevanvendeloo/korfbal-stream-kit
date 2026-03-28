-- AlterTable
ALTER TABLE "CallSheetItem" ADD COLUMN     "anchorType" TEXT,
ADD COLUMN     "isTimeAnchor" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProductionEvent" ADD COLUMN     "plannedEndTime" TIMESTAMP(3),
ADD COLUMN     "plannedStartTime" TIMESTAMP(3);
