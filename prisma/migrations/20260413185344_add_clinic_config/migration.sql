-- DropForeignKey
ALTER TABLE "TreatmentSession" DROP CONSTRAINT "TreatmentSession_appointmentId_fkey";

-- AlterTable
ALTER TABLE "TreatmentSession" ADD COLUMN     "sessionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "appointmentId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "clinic_config" (
    "id" SERIAL NOT NULL,
    "businessName" TEXT,
    "commercialName" TEXT,
    "nit" TEXT,
    "address" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "website" TEXT,
    "legalRepresentative" TEXT,
    "legalRepresentativeId" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "headerImageUrl" TEXT,
    "footerText" TEXT,
    "registrationNumber" TEXT,
    "licenseNumber" TEXT,
    "socialMedia" JSONB,
    "updatedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinic_config_nit_key" ON "clinic_config"("nit");

-- AddForeignKey
ALTER TABLE "TreatmentSession" ADD CONSTRAINT "TreatmentSession_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
