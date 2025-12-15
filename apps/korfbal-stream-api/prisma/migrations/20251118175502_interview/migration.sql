-- CreateEnum
CREATE TYPE "InterviewRole" AS ENUM ('PLAYER', 'COACH');

-- CreateTable
CREATE TABLE "InterviewSubject" (
    "id" SERIAL NOT NULL,
    "productionId" INTEGER NOT NULL,
    "side" "TeamSide" NOT NULL,
    "role" "InterviewRole" NOT NULL,
    "playerId" INTEGER NOT NULL,
    "titleDefinitionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewSubject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewSubject_productionId_idx" ON "InterviewSubject"("productionId");

-- CreateIndex
CREATE INDEX "InterviewSubject_playerId_idx" ON "InterviewSubject"("playerId");

-- CreateIndex
CREATE INDEX "InterviewSubject_titleDefinitionId_idx" ON "InterviewSubject"("titleDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSubject_productionId_side_role_titleDefinitionId_key" ON "InterviewSubject"("productionId", "side", "role", "titleDefinitionId");

-- AddForeignKey
ALTER TABLE "InterviewSubject" ADD CONSTRAINT "InterviewSubject_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSubject" ADD CONSTRAINT "InterviewSubject_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSubject" ADD CONSTRAINT "InterviewSubject_titleDefinitionId_fkey" FOREIGN KEY ("titleDefinitionId") REFERENCES "TitleDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
