// src/app.module.ts
import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PatientModule } from './modules/patient/patient.module';
import { ClinicalHistoryModule } from './modules/clinical-history/clinical-history.module';
import { TreatmentModule } from './modules/treatment/treatment.module';
import { TreatmentSessionModule } from './modules/treatment-session/treatment-session.module';
import { AppointmentModule } from './modules/appointment/appointment.module';
import { ClinicConfigModule } from './modules/clinic-config/clinic-config.module';
import { ClinicModule } from './modules/clinic/clinic.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';

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
    ClinicModule,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'api/auth/login', method: RequestMethod.POST },
        { path: 'api/auth/register', method: RequestMethod.POST },
        { path: 'docs', method: RequestMethod.GET },
        { path: 'docs/(.*)', method: RequestMethod.GET },
        { path: 'api/clinic-config/public', method: RequestMethod.GET },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}