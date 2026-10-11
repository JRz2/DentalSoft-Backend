import { Module } from '@nestjs/common';
import { TreatmentService } from './treatment.service';
import { TreatmentController } from './treatment.controller';
import { IdempotencyService } from 'src/common/services/idempotency.service';

@Module({
  controllers: [TreatmentController],
  providers: [TreatmentService, IdempotencyService],
  exports: [TreatmentService],
})
export class TreatmentModule {}
