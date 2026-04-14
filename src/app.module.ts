// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PatientModule } from './modules/patient/patient.module';
import { ClinicalHistoryModule } from './modules/clinical-history/clinical-history.module';
import { TreatmentModule } from './modules/treatment/treatment.module';
import { TreatmentSessionModule } from './modules/treatment-session/treatment-session.module';
import { AppointmentModule } from './modules/appointment/appointment.module';
import { ClinicConfigModule } from './modules/clinic-config/clinic-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, 
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    PatientModule,
    ClinicalHistoryModule,
    TreatmentModule,
    TreatmentSessionModule,
    AppointmentModule,
    ClinicConfigModule,
  ],
})
export class AppModule {}