-- CreateEnum
CREATE TYPE "ProductionEventType" AS ENUM ('STREAM_START', 'STREAM_STOP', 'AD_START', 'INTRO_VIDEO_START');

-- CreateTable
CREATE TABLE "ProductionEvent" (
    "id" SERIAL NOT NULL,
    "productionId" INTEGER NOT NULL,
    "eventType" "ProductionEventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionEvent_productionId_idx" ON "ProductionEvent"("productionId");

-- CreateIndex
CREATE INDEX "ProductionEvent_productionId_timestamp_idx" ON "ProductionEvent"("productionId", "timestamp");

-- CreateIndex
CREATE INDEX "ProductionEvent_eventType_idx" ON "ProductionEvent"("eventType");

-- AddForeignKey
ALTER TABLE "ProductionEvent" ADD CONSTRAINT "ProductionEvent_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;
