// src/modules/dashboard/dashboard.module.ts
import { Module } from '@nestjs/common';

// Controller y Service
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

// Prisma
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [],
  controllers: [DashboardController],
  providers: [DashboardService, PrismaService],
  exports: [DashboardService],
})
export class DashboardModule {}