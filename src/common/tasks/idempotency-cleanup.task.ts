import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class IdempotencyCleanupTask {
    private readonly logger = new Logger(IdempotencyCleanupTask.name);

    constructor(private readonly prisma: PrismaService) { }

    // Todos los días a las 3 AM
    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async cleanup() {
        const result = await this.prisma.idempotencyKey.deleteMany({
            where: { expiresAt: { lt: new Date() } },
        });
        if (result.count > 0) {
            this.logger.log(`🧹 Idempotency keys eliminadas: ${result.count}`);
        }
    }
}