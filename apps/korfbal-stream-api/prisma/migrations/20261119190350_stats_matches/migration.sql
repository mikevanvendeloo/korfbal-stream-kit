-- CreateTable
CREATE TABLE "StatsMatch" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL DEFAULT missing_organization_id(),
    "team" INTEGER NOT NULL,
    "tableName" TEXT NOT NULL,
    "matchDate" DATE NOT NULL,
    "ownTeam" TEXT,
    "opponentTeam" TEXT,
    "actionCount" INTEGER NOT NULL,
    "lastActionAt" BIGINT,
    "rows" JSONB NOT NULL,
    "figures" JSONB NOT NULL,
    "derivationVersion" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatsMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatsMatch_organizationId_team_matchDate_idx" ON "StatsMatch"("organizationId", "team", "matchDate");

-- CreateIndex
CREATE UNIQUE INDEX "StatsMatch_organizationId_team_tableName_key" ON "StatsMatch"("organizationId", "team", "tableName");

-- AddForeignKey
ALTER TABLE "StatsMatch" ADD CONSTRAINT "StatsMatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
