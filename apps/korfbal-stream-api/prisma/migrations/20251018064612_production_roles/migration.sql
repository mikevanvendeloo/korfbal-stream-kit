-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female');

-- AlterTable
ALTER TABLE "Sponsor" ADD COLUMN     "categories" TEXT;

-- CreateTable
CREATE TABLE "ProductionFunction" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "Gender",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionFunction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonCapability" (
    "personId" INTEGER NOT NULL,
    "productionFunctionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonCapability_pkey" PRIMARY KEY ("personId","productionFunctionId")
);

-- CreateTable
CREATE TABLE "MatchRoleAssignment" (
    "id" SERIAL NOT NULL,
    "matchScheduleId" INTEGER NOT NULL,
    "personId" INTEGER NOT NULL,
    "productionFunctionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionFunction_name_gender_key" ON "ProductionFunction"("name", "gender");

-- CreateIndex
CREATE INDEX "MatchRoleAssignment_matchScheduleId_idx" ON "MatchRoleAssignment"("matchScheduleId");

-- CreateIndex
CREATE INDEX "MatchRoleAssignment_personId_idx" ON "MatchRoleAssignment"("personId");

-- CreateIndex
CREATE INDEX "MatchRoleAssignment_productionFunctionId_idx" ON "MatchRoleAssignment"("productionFunctionId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchRoleAssignment_matchScheduleId_productionFunctionId_key" ON "MatchRoleAssignment"("matchScheduleId", "productionFunctionId");

-- AddForeignKey
ALTER TABLE "PersonCapability" ADD CONSTRAINT "PersonCapability_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonCapability" ADD CONSTRAINT "PersonCapability_productionFunctionId_fkey" FOREIGN KEY ("productionFunctionId") REFERENCES "ProductionFunction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRoleAssignment" ADD CONSTRAINT "MatchRoleAssignment_matchScheduleId_fkey" FOREIGN KEY ("matchScheduleId") REFERENCES "MatchSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRoleAssignment" ADD CONSTRAINT "MatchRoleAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRoleAssignment" ADD CONSTRAINT "MatchRoleAssignment_productionFunctionId_fkey" FOREIGN KEY ("productionFunctionId") REFERENCES "ProductionFunction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
