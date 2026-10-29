-- Hoofdstukken, phase 5 (openspec/changes/chapters): a hoofdstuk has no duration of its own, so the
-- API no longer writes the old segment duration. Until the follow-up release drops the column
-- (openspec/changes/chapters/followup-cleanup.sql) it gets a default.
ALTER TABLE "ProductionSegment" ALTER COLUMN "duurInMinuten" SET DEFAULT 0;
