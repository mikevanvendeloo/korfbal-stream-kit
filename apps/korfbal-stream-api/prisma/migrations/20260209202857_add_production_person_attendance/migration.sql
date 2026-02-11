-- CreateTable
CREATE TABLE "ProductionPerson" (
    "id" SERIAL NOT NULL,
    "productionId" INTEGER NOT NULL,
    "personId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionPerson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionPerson_productionId_idx" ON "ProductionPerson"("productionId");

-- CreateIndex
CREATE INDEX "ProductionPerson_personId_idx" ON "ProductionPerson"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionPerson_productionId_personId_key" ON "ProductionPerson"("productionId", "personId");

-- AddForeignKey
ALTER TABLE "ProductionPerson" ADD CONSTRAINT "ProductionPerson_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionPerson" ADD CONSTRAINT "ProductionPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
