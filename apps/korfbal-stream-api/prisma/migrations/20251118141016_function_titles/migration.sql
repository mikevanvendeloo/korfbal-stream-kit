-- CreateEnum
CREATE TYPE "TitleSourceType" AS ENUM ('COMMENTARY', 'PRESENTATION', 'PRESENTATION_AND_ANALIST', 'TEAM_PLAYER', 'TEAM_COACH');

-- CreateEnum
CREATE TYPE "TeamSide" AS ENUM ('HOME', 'AWAY', 'NONE');

-- CreateTable
CREATE TABLE "TitleDefinition" (
    "id" SERIAL NOT NULL,
    "productionId" INTEGER,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TitleDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TitlePart" (
    "id" SERIAL NOT NULL,
    "titleDefinitionId" INTEGER NOT NULL,
    "sourceType" "TitleSourceType" NOT NULL,
    "teamSide" "TeamSide" NOT NULL DEFAULT 'NONE',
    "limit" INTEGER,
    "filters" JSONB,

    CONSTRAINT "TitlePart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TitleDefinition_productionId_order_idx" ON "TitleDefinition"("productionId", "order");

-- CreateIndex
CREATE INDEX "TitlePart_titleDefinitionId_idx" ON "TitlePart"("titleDefinitionId");

-- AddForeignKey
ALTER TABLE "TitleDefinition" ADD CONSTRAINT "TitleDefinition_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TitlePart" ADD CONSTRAINT "TitlePart_titleDefinitionId_fkey" FOREIGN KEY ("titleDefinitionId") REFERENCES "TitleDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
