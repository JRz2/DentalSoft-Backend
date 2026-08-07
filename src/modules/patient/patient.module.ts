import { Module } from '@nestjs/common';
import { PatientService } from './patient.service';
import { PatientController } from './patient.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UploadModule } from 'src/common/uploads/upload.module';

@Module({
  controllers: [PatientController],
  providers: [PatientService],
  imports: [
    PrismaModule,
    UploadModule,
  ],
})
export class PatientModule {}
