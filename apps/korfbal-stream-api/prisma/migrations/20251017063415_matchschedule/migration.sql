-- CreateTable
CREATE TABLE "MatchSchedule" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "homeTeamName" TEXT NOT NULL,
    "awayTeamName" TEXT NOT NULL,
    "accommodationName" TEXT,
    "accommodationRoute" TEXT,
    "attendanceTime" TIMESTAMP(3),
    "isPracticeMatch" BOOLEAN NOT NULL DEFAULT false,
    "isHomeMatch" BOOLEAN NOT NULL DEFAULT false,
    "isCompetitiveMatch" BOOLEAN NOT NULL DEFAULT false,
    "fieldName" TEXT,
    "refereeName" TEXT,
    "reserveRefereeName" TEXT,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchSchedule_externalId_key" ON "MatchSchedule"("externalId");

-- CreateIndex
CREATE INDEX "MatchSchedule_date_idx" ON "MatchSchedule"("date");
