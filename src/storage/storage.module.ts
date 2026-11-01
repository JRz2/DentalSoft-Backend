import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';

@Module({
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService], // Lo exportamos por si otros módulos (como Patient) necesitan generar URLs
})
export class StorageModule {}