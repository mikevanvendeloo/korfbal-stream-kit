-- CreateTable
CREATE TABLE "ProductionEventPosition" (
    "eventId" TEXT NOT NULL,
    "positionId" INTEGER NOT NULL,

    CONSTRAINT "ProductionEventPosition_pkey" PRIMARY KEY ("eventId","positionId")
);

-- AddForeignKey
ALTER TABLE "ProductionEventPosition" ADD CONSTRAINT "ProductionEventPosition_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ProductionEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEventPosition" ADD CONSTRAINT "ProductionEventPosition_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;
