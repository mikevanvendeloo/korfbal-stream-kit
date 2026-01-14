-- CreateEnum
CREATE TYPE "ReportSection" AS ENUM ('OPLOPEN', 'WEDSTRIJD', 'STUDIO', 'COMMENTAAR', 'SPEAKER', 'INTERVIEWS');

-- CreateTable
CREATE TABLE "ProductionReport" (
    "id" SERIAL NOT NULL,
    "productionId" INTEGER NOT NULL,
    "attendees" TEXT,
    "matchSponsor" TEXT,
    "notes" TEXT,
    "interviewRationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionReportRole" (
    "id" SERIAL NOT NULL,
    "productionReportId" INTEGER NOT NULL,
    "section" "ReportSection" NOT NULL,
    "positionName" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionReportRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionReport_productionId_key" ON "ProductionReport"("productionId");

-- CreateIndex
CREATE INDEX "ProductionReport_productionId_idx" ON "ProductionReport"("productionId");

-- CreateIndex
CREATE INDEX "ProductionReportRole_productionReportId_section_orderIndex_idx" ON "ProductionReportRole"("productionReportId", "section", "orderIndex");

-- AddForeignKey
ALTER TABLE "ProductionReport" ADD CONSTRAINT "ProductionReport_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionReportRole" ADD CONSTRAINT "ProductionReportRole_productionReportId_fkey" FOREIGN KEY ("productionReportId") REFERENCES "ProductionReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
