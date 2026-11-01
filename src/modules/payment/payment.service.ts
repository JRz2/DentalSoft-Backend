// src/modules/payment/payment.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { PaymentKpisQueryDto } from './dto/payment-kpis.dto';

@Injectable()
export class PaymentService {
    constructor(private prisma: PrismaService) { }

    // ═══════════════════════════════════════════════════════════════
    // 1. KPIs (Ingresos y Deudas)
    // ═══════════════════════════════════════════════════════════════
    async getKPIs(query: PaymentKpisQueryDto, clinicId: number) {
        const { startDate, endDate } = query;

        const dateFilter = startDate && endDate ? {
            gte: new Date(startDate),
            lte: new Date(endDate),
        } : undefined;

        const [totalIncomeAgg, cashIncomeAgg, transferIncomeAgg] = await Promise.all([
            this.prisma.payment.aggregate({
                where: { clinicId, status: 'ACTIVE', ...(dateFilter && { paymentDate: dateFilter }) },
                _sum: { amount: true },
            }),
            this.prisma.payment.aggregate({
                where: { clinicId, status: 'ACTIVE', paymentMethod: 'CASH', ...(dateFilter && { paymentDate: dateFilter }) },
                _sum: { amount: true },
            }),
            this.prisma.payment.aggregate({
                where: { clinicId, status: 'ACTIVE', paymentMethod: 'TRANSFER', ...(dateFilter && { paymentDate: dateFilter }) },
                _sum: { amount: true },
            }),
        ]);

        // El filtro de Deudas (Global para la clínica)
        const pendingDebtAgg = await this.prisma.treatment.aggregate({
            where: {
                clinicId,
                status: { notIn: ['CANCELLED'] },
                remainingBalance: { gt: 0 },
            },
            _sum: { remainingBalance: true },
        });

        return {
            totalIncome: Number(totalIncomeAgg._sum.amount || 0),
            cashIncome: Number(cashIncomeAgg._sum.amount || 0),
            transferIncome: Number(transferIncomeAgg._sum.amount || 0),
            pendingDebt: Number(pendingDebtAgg._sum.remainingBalance || 0),
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. Saldos Pendientes (Deudas por paciente)
    // ═══════════════════════════════════════════════════════════════
    async getPendingBalances(clinicId: number) {
        const treatments = await this.prisma.treatment.findMany({
            where: {
                clinicId,
                status: { not: 'CANCELLED' },
                remainingBalance: { gt: 0 }
            },
            include: {
                clinicalHistory: { include: { patient: true } }
            },
            orderBy: { startDate: 'asc' }
        });

        // 🔥 MAPEAMOS AL CONTRATO EXACTO DEL FRONTEND (PendingBalance)
        return treatments.map(t => ({
            treatmentId: t.id,
            patientId: t.clinicalHistory?.patient?.id || 0,
            patientName: t.clinicalHistory?.patient?.fullName || 'Paciente Desconocido',
            treatmentName: t.name,
            remainingBalance: Number(t.remainingBalance || 0),
            finalAmount: Number(t.finalAmount || t.totalCost || 0), // Preferimos finalAmount, si no totalCost
            amountPaid: Number(t.amountPaid || 0),
        }));
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. Listado de Pagos (Historial)
    // ═══════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════
    // 3. Listado de Pagos (Historial con Paginación y Búsqueda)
    // ═══════════════════════════════════════════════════════════════
    async findAll(query: PaymentQueryDto, clinicId: number) {
        // 🔥 Extraemos page, limit y search para que no se pasen al where
        const { startDate, endDate, page, limit, search, ...rest } = query as any;

        // Armamos el where con lo que sí acepta Prisma
        const where: any = {
            clinicId, // ⚠️ Seguridad Multi-Tenant
            ...rest,
        };

        if (startDate && endDate) {
            where.paymentDate = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }

        // 🔍 Búsqueda en campos relacionados (ej. nombre del paciente)
        if (search) {
            where.OR = [
                { treatment: { name: { contains: search, mode: 'insensitive' } } },
                { treatment: { clinicalHistory: { patient: { fullName: { contains: search, mode: 'insensitive' } } } } }
            ];
        }

        // 📄 Paginación
        const pageNumber = Number(page) || 1;
        const pageSize = Number(limit) || 10;
        const skip = (pageNumber - 1) * pageSize;

        // Ejecutamos las dos consultas en paralelo (datos y conteo total)
        const [data, total] = await Promise.all([
            this.prisma.payment.findMany({
                where,
                include: {
                    treatment: {
                        include: {
                            clinicalHistory: { include: { patient: true } }
                        }
                    }
                },
                orderBy: { paymentDate: 'desc' },
                skip,
                take: pageSize,
            }),
            this.prisma.payment.count({ where })
        ]);

        return {
            data,
            meta: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize),
            }
        };
    }
}