/*
  Warnings:

  - You are about to drop the `AppSetting` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "AppSetting";

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);
