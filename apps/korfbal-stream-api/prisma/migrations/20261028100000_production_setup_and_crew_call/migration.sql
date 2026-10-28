-- Opbouwtijd and verzameltijd per production, for the day planning. Null means the organization's
-- default (services/dayPlanning.ts), so existing productions follow it without a backfill.
ALTER TABLE "Production" ADD COLUMN "setupTime" TIMESTAMP(3);
ALTER TABLE "Production" ADD COLUMN "crewCallTime" TIMESTAMP(3);
