-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_clinicId_fkey";

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "clinicId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
