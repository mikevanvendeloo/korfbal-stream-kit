/*
  Warnings:

  - Made the column `functionName` on table `Capability` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Capability" ADD COLUMN     "vMixTitle" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "functionName" SET NOT NULL;
