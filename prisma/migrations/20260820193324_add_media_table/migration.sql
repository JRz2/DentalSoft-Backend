-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'XRAY', 'SCAN', 'OTHER');

-- CreateEnum
CREATE TYPE "MediaCategory" AS ENUM ('TREATMENT', 'SESSION', 'PRE_OPERATIVE', 'POST_OPERATIVE', 'INTRAOPERATIVE', 'DIAGNOSTIC', 'FOLLOW_UP');

-- CreateTable
CREATE TABLE "media" (
    "id" SERIAL NOT NULL,
    "clinicId" INTEGER NOT NULL,
    "treatmentId" INTEGER,
    "sessionId" INTEGER,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "category" "MediaCategory",
    "title" TEXT,
    "description" TEXT,
    "uploadedBy" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_clinicId_idx" ON "media"("clinicId");

-- CreateIndex
CREATE INDEX "media_treatmentId_idx" ON "media"("treatmentId");

-- CreateIndex
CREATE INDEX "media_sessionId_idx" ON "media"("sessionId");

-- CreateIndex
CREATE INDEX "media_mediaType_idx" ON "media"("mediaType");

-- CreateIndex
CREATE INDEX "media_category_idx" ON "media"("category");

-- CreateIndex
CREATE INDEX "media_uploadedAt_idx" ON "media"("uploadedAt");

-- CreateIndex
CREATE INDEX "media_deletedAt_idx" ON "media"("deletedAt");

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "Treatment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TreatmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
