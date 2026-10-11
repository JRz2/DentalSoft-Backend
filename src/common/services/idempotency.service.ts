import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';

const TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

@Injectable()
export class IdempotencyService {
    constructor(private readonly prisma: PrismaService) { }

    private hash(payload: unknown): string {
        return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    }

    /**
     * Ejecuta un handler de forma idempotente usando el header `Idempotency-Key`.
     *
     * Reglas:
     * - Sin header → ejecuta normal (sin protección, NO recomendado en pagos).
     * - Con header nuevo → ejecuta, guarda la respuesta.
     * - Con header repetido + mismo payload → devuelve la respuesta cacheada.
     * - Con header repetido + distinto payload → 409 Conflict.
     * - Con dos requests concurrentes con la misma key → el segundo recibe 409
     *   mientras el primero esté en curso.
     */
    async run<T>(
        key: string | undefined,
        userId: number,
        endpoint: string,
        method: string,
        payload: unknown,
        handler: (tx: Prisma.TransactionClient) => Promise<T>,
    ): Promise<T> {
        // Sin key → sin protección (solo para endpoints no críticos)
        if (!key) {
            return this.prisma.$transaction(handler);
        }

        const requestHash = this.hash(payload);

        // 1. Fast path: ya existe la key
        const existing = await this.prisma.idempotencyKey.findUnique({
            where: { key_userId: { key, userId } },
        });

        if (existing) {
            if (existing.requestHash !== requestHash) {
                throw new ConflictException({
                    code: 'IDEMPOTENCY_KEY_REUSED',
                    message:
                        'Esta clave de idempotencia ya fue usada con datos distintos',
                });
            }
            if (existing.responseBody) {
                return existing.responseBody as T;
            }
            throw new ConflictException({
                code: 'REQUEST_IN_PROGRESS',
                message: 'Ya hay una solicitud en curso con esta clave',
            });
        }

        // 2. Ejecutar handler + registrar idempotencia en la misma transacción
        try {
            return await this.prisma.$transaction(async (tx) => {
                // Insert placeholder: el unique (key, userId) protege contra race
                await tx.idempotencyKey.create({
                    data: {
                        key,
                        userId,
                        endpoint,
                        method,
                        requestHash,
                        expiresAt: new Date(Date.now() + TTL_MS),
                    },
                });

                const result = await handler(tx);

                await tx.idempotencyKey.update({
                    where: { key_userId: { key, userId } },
                    data: {
                        responseBody: result as any,
                        statusCode: 201,
                    },
                });

                return result;
            });
        } catch (err) {
            // P2002 = unique constraint (otro request ganó la carrera)
            if (
                err instanceof Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2002'
            ) {
                const winner = await this.prisma.idempotencyKey.findUnique({
                    where: { key_userId: { key, userId } },
                });
                if (winner?.responseBody) return winner.responseBody as T;
                throw new ConflictException({
                    code: 'REQUEST_IN_PROGRESS',
                    message: 'Ya hay una solicitud en curso con esta clave',
                });
            }
            throw err;
        }
    }
}