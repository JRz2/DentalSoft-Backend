-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PENDING', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- AlterTable
ALTER TABLE "TreatmentSession" ADD COLUMN     "status" "SessionStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "TreatmentSession_status_idx" ON "TreatmentSession"("status");
