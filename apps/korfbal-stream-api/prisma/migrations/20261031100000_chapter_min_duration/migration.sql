-- Parallel lanes (openspec/changes/parallel-lanes D3): an optional minimum duration per hoofdstuk, in seconds
ALTER TABLE "ProductionSegment" ADD COLUMN "minDurationSec" INTEGER;
ALTER TABLE "CallSheetTemplateChapter" ADD COLUMN "minDurationSec" INTEGER;
