-- A cue code on draaiboek template items too, copied to the production's callsheet items (e.g. for vMix).
-- AlterTable
ALTER TABLE "CallSheetTemplateItem" ADD COLUMN     "cue" TEXT NOT NULL DEFAULT '';

