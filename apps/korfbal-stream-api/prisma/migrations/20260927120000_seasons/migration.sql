-- Seasons (seizoenen): 1 July - 30 June, Europe/Amsterdam local time.
-- Hand-edited: columns are added nullable, backfilled, then made NOT NULL.

-- CreateTable
CREATE TABLE "Season" (
    "id" SERIAL NOT NULL,
    "startYear" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Season_startYear_key" ON "Season"("startYear");

-- CreateIndex
CREATE UNIQUE INDEX "Season_name_key" ON "Season"("name");

-- Seed seasons: every season derived from an existing match date, plus 2025/2026 for existing players.
-- "date" is stored as UTC (timestamp without time zone); convert to Amsterdam local time first.
INSERT INTO "Season" ("startYear", "name")
SELECT y, y::text || '/' || (y + 1)::text
FROM (
    SELECT DISTINCT
        CASE
            WHEN EXTRACT(MONTH FROM (("date" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Amsterdam')) >= 7
                THEN EXTRACT(YEAR FROM (("date" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Amsterdam'))::int
            ELSE EXTRACT(YEAR FROM (("date" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Amsterdam'))::int - 1
        END AS y
    FROM "MatchSchedule"
    UNION
    SELECT 2025
) AS years
ON CONFLICT ("startYear") DO NOTHING;

-- AlterTable: add nullable columns
ALTER TABLE "MatchSchedule" ADD COLUMN "seasonId" INTEGER;
ALTER TABLE "Player" ADD COLUMN "seasonId" INTEGER;

-- Backfill matches from their date
UPDATE "MatchSchedule" m
SET "seasonId" = s."id"
FROM "Season" s
WHERE s."startYear" = CASE
    WHEN EXTRACT(MONTH FROM ((m."date" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Amsterdam')) >= 7
        THEN EXTRACT(YEAR FROM ((m."date" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Amsterdam'))::int
    ELSE EXTRACT(YEAR FROM ((m."date" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Amsterdam'))::int - 1
END;

-- Backfill all existing players into 2025/2026
UPDATE "Player"
SET "seasonId" = (SELECT "id" FROM "Season" WHERE "startYear" = 2025);

-- Make required
ALTER TABLE "MatchSchedule" ALTER COLUMN "seasonId" SET NOT NULL;
ALTER TABLE "Player" ALTER COLUMN "seasonId" SET NOT NULL;

-- externalId is now unique per season instead of globally
DROP INDEX "Player_externalId_key";

-- CreateIndex
CREATE INDEX "MatchSchedule_seasonId_date_idx" ON "MatchSchedule"("seasonId", "date");

-- CreateIndex
CREATE INDEX "Player_seasonId_clubId_idx" ON "Player"("seasonId", "clubId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_seasonId_externalId_key" ON "Player"("seasonId", "externalId");

-- AddForeignKey
ALTER TABLE "MatchSchedule" ADD CONSTRAINT "MatchSchedule_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
