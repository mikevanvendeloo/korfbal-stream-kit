/*
  Warnings:

  - The primary key for the `ProductionEvent` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `eventType` on the `ProductionEvent` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `ProductionEvent` table. All the data in the column will be lost.
  - Added the required column `order` to the `ProductionEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `ProductionEvent` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('WAITING', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TriggerSource" AS ENUM ('VMIX', 'MANUAL', 'AUTO');

-- DropIndex
DROP INDEX "ProductionEvent_eventType_idx";

-- DropIndex
DROP INDEX "ProductionEvent_productionId_timestamp_idx";

-- AlterTable
ALTER TABLE "CallSheetItem" ADD COLUMN     "isInVenue" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProductionEvent" DROP CONSTRAINT "ProductionEvent_pkey",
DROP COLUMN "eventType",
DROP COLUMN "timestamp",
ADD COLUMN     "actualStartTime" TIMESTAMP(3),
ADD COLUMN     "order" INTEGER NOT NULL,
ADD COLUMN     "status" "EventStatus" NOT NULL DEFAULT 'WAITING',
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "triggerSource" "TriggerSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "vMixInputName" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "ProductionEvent_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "ProductionEvent_id_seq";

-- DropEnum
DROP TYPE "ProductionEventType";

-- CreateTable
CREATE TABLE "PositionLink" (
    "id" SERIAL NOT NULL,
    "sourcePositionId" INTEGER NOT NULL,
    "targetPositionId" INTEGER NOT NULL,

    CONSTRAINT "PositionLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PositionLink_sourcePositionId_targetPositionId_key" ON "PositionLink"("sourcePositionId", "targetPositionId");

-- CreateIndex
CREATE INDEX "ProductionEvent_productionId_createdAt_idx" ON "ProductionEvent"("productionId", "createdAt");

-- AddForeignKey
ALTER TABLE "PositionLink" ADD CONSTRAINT "PositionLink_sourcePositionId_fkey" FOREIGN KEY ("sourcePositionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionLink" ADD CONSTRAINT "PositionLink_targetPositionId_fkey" FOREIGN KEY ("targetPositionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;
