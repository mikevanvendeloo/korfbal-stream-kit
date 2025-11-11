-- CreateTable
CREATE TABLE "PlayerImage" (
    "id" SERIAL NOT NULL,
    "subject" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerImage_subject_idx" ON "PlayerImage"("subject");
