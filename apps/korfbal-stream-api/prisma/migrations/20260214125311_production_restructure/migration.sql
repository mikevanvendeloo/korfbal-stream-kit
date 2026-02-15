-- CreateTable
CREATE TABLE "ProductionPersonPosition" (
    "id" SERIAL NOT NULL,
    "productionId" INTEGER NOT NULL,
    "personId" INTEGER NOT NULL,
    "positionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionPersonPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionPersonPosition_productionId_idx" ON "ProductionPersonPosition"("productionId");

-- CreateIndex
CREATE INDEX "ProductionPersonPosition_personId_idx" ON "ProductionPersonPosition"("personId");

-- CreateIndex
CREATE INDEX "ProductionPersonPosition_positionId_idx" ON "ProductionPersonPosition"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionPersonPosition_productionId_personId_positionId_key" ON "ProductionPersonPosition"("productionId", "personId", "positionId");

-- AddForeignKey
ALTER TABLE "ProductionPersonPosition" ADD CONSTRAINT "ProductionPersonPosition_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionPersonPosition" ADD CONSTRAINT "ProductionPersonPosition_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionPersonPosition" ADD CONSTRAINT "ProductionPersonPosition_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;
