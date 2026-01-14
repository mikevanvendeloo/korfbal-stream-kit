/*
  Warnings:

  - You are about to drop the column `attendees` on the `ProductionReport` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `ProductionReport` table. All the data in the column will be lost.
  - You are about to drop the `ProductionReportRole` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ProductionReportRole" DROP CONSTRAINT "ProductionReportRole_productionReportId_fkey";

-- AlterTable
ALTER TABLE "ProductionReport" DROP COLUMN "attendees",
DROP COLUMN "notes";

-- DropTable
DROP TABLE "public"."ProductionReportRole";

-- DropEnum
DROP TYPE "public"."ReportSection";
