ALTER TABLE "TreatmentSession" DROP CONSTRAINT "TreatmentSession_appointmentId_fkey";

-- AlterTable
ALTER TABLE "TreatmentSession" ALTER COLUMN "appointmentId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "TreatmentSession" ADD CONSTRAINT "TreatmentSession_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
"@ | Out-File -FilePath prisma/migrations/20260409223949_make_appointment_optional/migration.sql -Encoding utf8