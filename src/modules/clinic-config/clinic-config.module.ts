import { Module } from '@nestjs/common';
import { ClinicConfigService } from './clinic-config.service';
import { ClinicConfigController } from './clinic-config.controller';

@Module({
  controllers: [ClinicConfigController],
  providers: [ClinicConfigService],
  exports: [ClinicConfigService],
})
export class ClinicConfigModule {}
