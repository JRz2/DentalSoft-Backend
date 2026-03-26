import { Module } from '@nestjs/common';
import { ClinicalHistoryService } from './clinical-history.service';
import { ClinicalHistoryController } from './clinical-history.controller';

@Module({
  controllers: [ClinicalHistoryController],
  providers: [ClinicalHistoryService],
  exports: [ClinicalHistoryService],
})
export class ClinicalHistoryModule {}
