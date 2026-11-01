-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Patient_isActive_idx" ON "Patient"("isActive");
