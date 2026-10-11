import { BadRequestException, ForbiddenException, Injectable, NotFoundException,
  UnauthorizedException } from '@nestjs/common';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { UpdateTreatmentDto } from './dto/update-treatment.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { TreatmentResponseDto } from './dto/treatment-response.dto';
import { PaymentStatus, Role, Prisma } from '@prisma/client';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { UpdateCostDto } from './dto/update-cost.dto';
import { VoidPaymentDto } from './dto/void-payment.dto';
import { IdempotencyService } from 'src/common/services/idempotency.service';

@Injectable()
export class TreatmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) { }

  // ============================================================
  // MAPPER
  // ============================================================

  private ToResponseDto(treatment: any): TreatmentResponseDto {
    return {
      id: treatment.id,
      clinicalHistoryId: treatment.clinicalHistoryId,
      name: treatment.name,
      description: treatment.description,
      type: treatment.type,
      estimatedSessions: treatment.estimatedSessions,
      status: treatment.status,
      startDate: treatment.startDate,
      endDate: treatment.endDate,
      createdAt: treatment.createdAt,
      updatedAt: treatment.updatedAt,
      sessions: treatment.sessions || [],
      totalCost: treatment.totalCost ? Number(treatment.totalCost) : 0,
      discount: treatment.discount ? Number(treatment.discount) : 0,
      finalAmount: treatment.finalAmount ? Number(treatment.finalAmount) : 0,
      amountPaid: treatment.amountPaid ? Number(treatment.amountPaid) : 0,
      remainingBalance: treatment.remainingBalance
        ? Number(treatment.remainingBalance)
        : 0,
      paymentStatus: treatment.paymentStatus,
      patient: treatment.clinicalHistory?.patient
        ? {
          id: treatment.clinicalHistory.patient.id,
          fullName: treatment.clinicalHistory.patient.fullName,
          phoneNumber: treatment.clinicalHistory.patient.phoneNumber,
          email: treatment.clinicalHistory.patient.email,
          medicalRecordNum:
            treatment.clinicalHistory.patient.medicalRecordNum,
        }
        : undefined,
    };
  }

  // ============================================================
  // HELPERS PRIVADOS
  // ============================================================

  /**
   * Recalcula el estado de pago del tratamiento.
   * IMPORTANTE: siempre debe llamarse dentro de una transacción.
   */
  private async recalculateTreatmentPaymentState(
    tx: Prisma.TransactionClient,
    treatmentId: number,
  ): Promise<void> {
    const treatment = await tx.treatment.findUnique({
      where: { id: treatmentId },
      select: { totalCost: true, discount: true },
    });
    if (!treatment) return;

    const finalAmount =
      Number(treatment.totalCost ?? 0) - Number(treatment.discount ?? 0);

    const agg = await tx.payment.aggregate({
      where: { treatmentId, status: 'ACTIVE' },
      _sum: { amount: true },
    });

    const amountPaid = Number(agg._sum.amount ?? 0);
    const remainingBalance = Math.max(0, finalAmount - amountPaid);

    let paymentStatus: PaymentStatus;
    if (amountPaid <= 0) paymentStatus = 'UNPAID';
    else if (amountPaid + 0.001 < finalAmount) paymentStatus = 'PARTIAL';
    else paymentStatus = 'PAID';

    await tx.treatment.update({
      where: { id: treatmentId },
      data: {
        finalAmount,
        amountPaid,
        remainingBalance,
        paymentStatus,
      },
    });
  }

  private async validateUser(
    userId: number,
    clinicId: number,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, clinicId, deletedAt: null },
    });
    if (!user) {
      throw new UnauthorizedException(
        `User with ID ${userId} not found or doesn't belong to this clinic`,
      );
    }
  }

  private async validateTreatment(id: number, clinicId: number): Promise<any> {
    const treatment = await this.prisma.treatment.findFirst({
      where: { id, clinicId },
    });
    if (!treatment) {
      throw new NotFoundException(
        `Treatment with ID ${id} not found in this clinic`,
      );
    }
    return treatment;
  }

  // ============================================================
  // CRUD
  // ============================================================

  async create(
    createDto: CreateTreatmentDto,
    clinicalHistoryId: number,
    userId: number,
    clinicId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TreatmentResponseDto> {
    const clinicalHistory = await this.prisma.clinicalHistory.findUnique({
      where: { id: clinicalHistoryId },
    });

    if (!clinicalHistory) {
      throw new NotFoundException(
        `Clinical history with ID ${clinicalHistoryId} not found`,
      );
    }

    await this.validateUser(userId, clinicId);

    const totalCost = createDto.totalCost || 0;
    const paymentAmount = createDto.paymentAmount || 0;
    const hasPayment = paymentAmount > 0 && createDto.paymentMethod;

    const amountPaid = hasPayment ? paymentAmount : 0;
    const remainingBalance = hasPayment
      ? totalCost - paymentAmount
      : totalCost || 0;

    let paymentStatus: PaymentStatus;
    if (!totalCost || totalCost === 0) {
      paymentStatus = 'UNPAID';
    } else if (hasPayment && remainingBalance <= 0) {
      paymentStatus = 'PAID';
    } else if (hasPayment && remainingBalance > 0) {
      paymentStatus = 'PARTIAL';
    } else {
      paymentStatus = 'UNPAID';
    }

    const result = await this.prisma.$transaction(async (prisma) => {
      const newTreatment = await prisma.treatment.create({
        data: {
          clinicalHistoryId,
          name: createDto.name,
          description: createDto.description,
          type: createDto.type,
          estimatedSessions: createDto.estimatedSessions,
          status: createDto.status || 'PLANNED',
          clinicId,
          totalCost,
          discount: 0,
          finalAmount: totalCost || 0,
          amountPaid,
          remainingBalance,
          paymentStatus,
          startDate: createDto.startDate || new Date(),
        },
        include: { sessions: true },
      });

      let payment: any = null;

      if (hasPayment) {
        if (!createDto.paymentMethod) {
          throw new BadRequestException('El método de pago es requerido');
        }
        payment = await prisma.payment.create({
          data: {
            treatmentId: newTreatment.id,
            clinicId,
            amount: paymentAmount,
            paymentMethod: createDto.paymentMethod,
            reference: createDto.paymentReference || null,
            notes: `Pago inicial de ${paymentAmount} al crear el tratamiento`,
            registeredBy: userId,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
            status: 'ACTIVE',
          },
        });

        if (createDto.estimatedSessions === 1 && remainingBalance <= 0) {
          await prisma.treatment.update({
            where: { id: newTreatment.id },
            data: { status: 'COMPLETED' },
          });
        }
      }

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'CREATE_TREATMENT',
          entity: 'Treatment',
          entityId: newTreatment.id.toString(),
          oldValue: undefined,
          newValue: JSON.stringify({ treatment: newTreatment, payment }),
          clinicId,
          ipAddress: ipAddress || null,
          createdAt: new Date(),
        },
      });

      return { treatment: newTreatment, payment };
    });

    return this.ToResponseDto(result.treatment);
  }

  async findByPatientId(
    patientId: number,
    clinicId: number,
  ): Promise<TreatmentResponseDto[]> {
    const treatments = await this.prisma.treatment.findMany({
      where: { clinicalHistory: { patientId }, clinicId },
      include: {
        sessions: { orderBy: { sessionNumber: 'asc' } },
        clinicalHistory: { include: { patient: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return treatments.map((t) => this.ToResponseDto(t));
  }

  async findAll(clinicId: number): Promise<TreatmentResponseDto[]> {
    const treatments = await this.prisma.treatment.findMany({
      where: { clinicId },
      include: {
        clinicalHistory: {
          include: {
            patient: {
              select: { id: true, fullName: true, medicalRecordNum: true },
            },
          },
        },
        sessions: {
          orderBy: { sessionNumber: 'asc' },
          include: {
            appointment: {
              select: { id: true, appointmentDate: true, status: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return treatments.map((t) => this.ToResponseDto(t));
  }

  async findOne(id: number, clinicId: number): Promise<TreatmentResponseDto> {
    const treatment = await this.prisma.treatment.findFirst({
      where: { id, clinicId },
      include: {
        clinicalHistory: {
          include: {
            patient: {
              select: {
                id: true,
                fullName: true,
                medicalRecordNum: true,
                phoneNumber: true,
                email: true,
              },
            },
          },
        },
        sessions: {
          orderBy: { sessionNumber: 'asc' },
          include: {
            appointment: {
              select: { id: true, appointmentDate: true, status: true },
            },
          },
        },
      },
    });

    if (!treatment) {
      throw new NotFoundException(
        `Treatment with ID ${id} not found in this clinic`,
      );
    }

    return this.ToResponseDto(treatment);
  }

  async update(
    id: number,
    updateDto: UpdateTreatmentDto,
    clinicId: number,
    userId: number,
  ): Promise<TreatmentResponseDto> {
    const existingTreatment = await this.prisma.treatment.findFirst({
      where: { id, clinicId },
    });

    if (!existingTreatment) {
      throw new NotFoundException(
        `Treatment with ID ${id} not found in this clinic`,
      );
    }

    await this.validateUser(userId, clinicId);

    const updatedTreatment = await this.prisma.$transaction(async (prisma) => {
      const updateData: any = {};

      if (updateDto.name !== undefined) updateData.name = updateDto.name;
      if (updateDto.description !== undefined)
        updateData.description = updateDto.description;
      if (updateDto.type !== undefined) updateData.type = updateDto.type;
      if (updateDto.estimatedSessions !== undefined)
        updateData.estimatedSessions = updateDto.estimatedSessions;
      if (updateDto.status !== undefined) updateData.status = updateDto.status;
      if (updateDto.startDate !== undefined)
        updateData.startDate = updateDto.startDate;
      if (updateDto.endDate !== undefined)
        updateData.endDate = updateDto.endDate;

      const treatment = await prisma.treatment.update({
        where: { id },
        data: updateData,
        include: {
          sessions: true,
          clinicalHistory: { include: { patient: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_TREATMENT',
          entity: 'Treatment',
          entityId: id.toString(),
          oldValue: JSON.stringify(existingTreatment),
          newValue: JSON.stringify(treatment),
          clinicId,
          ipAddress: null,
          createdAt: new Date(),
        },
      });

      return treatment;
    });

    return this.ToResponseDto(updatedTreatment);
  }

  async start(
    id: number,
    userId: number,
    userRole: Role,
    clinicId: number,
  ): Promise<{ message: string; treatment: TreatmentResponseDto }> {
    const treatment = await this.prisma.treatment.findFirst({
      where: { id, clinicId },
    });

    if (!treatment) {
      throw new NotFoundException(`Treatment with ID ${id} not found`);
    }

    if (userRole !== 'ADMIN' && userRole !== 'DOCTOR') {
      throw new ForbiddenException('Only ADMIN or DOCTOR can start treatments');
    }

    if (treatment.status === 'IN_PROGRESS') {
      throw new BadRequestException('Treatment is already in progress');
    }
    if (treatment.status === 'COMPLETED') {
      throw new BadRequestException('Cannot start a completed treatment');
    }
    if (treatment.status === 'CANCELLED') {
      throw new BadRequestException('Cannot start a cancelled treatment');
    }

    const updatedTreatment = await this.prisma.$transaction(async (prisma) => {
      const updated = await prisma.treatment.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
        include: {
          clinicalHistory: {
            include: {
              patient: {
                select: { id: true, fullName: true, medicalRecordNum: true },
              },
            },
          },
          sessions: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'START_TREATMENT',
          entity: 'Treatment',
          entityId: id.toString(),
          oldValue: JSON.stringify(treatment),
          newValue: JSON.stringify(updated),
          clinicId,
          ipAddress: null,
          createdAt: new Date(),
        },
      });

      return updated;
    });

    return {
      message: 'Treatment started successfully',
      treatment: this.ToResponseDto(updatedTreatment),
    };
  }

  async complete(
    id: number,
    userId: number,
    userRole: Role,
    clinicId: number,
  ): Promise<{ message: string; treatment: TreatmentResponseDto }> {
    const treatment = await this.prisma.treatment.findFirst({
      where: { id, clinicId },
    });

    if (!treatment) {
      throw new NotFoundException(`Treatment with ID ${id} not found`);
    }

    if (userRole !== 'ADMIN' && userRole !== 'DOCTOR') {
      throw new ForbiddenException(
        'Only ADMIN or DOCTOR can complete treatments',
      );
    }

    if (treatment.status === 'COMPLETED') {
      throw new BadRequestException('Treatment is already completed');
    }
    if (treatment.status === 'CANCELLED') {
      throw new BadRequestException('Cannot complete a cancelled treatment');
    }

    const updatedTreatment = await this.prisma.$transaction(async (prisma) => {
      const updated = await prisma.treatment.update({
        where: { id },
        data: { status: 'COMPLETED', endDate: new Date() },
        include: {
          clinicalHistory: {
            include: {
              patient: {
                select: { id: true, fullName: true, medicalRecordNum: true },
              },
            },
          },
          sessions: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'COMPLETE_TREATMENT',
          entity: 'Treatment',
          entityId: id.toString(),
          oldValue: JSON.stringify(treatment),
          newValue: JSON.stringify(updated),
          clinicId,
          ipAddress: null,
          createdAt: new Date(),
        },
      });

      return updated;
    });

    return {
      message: 'Treatment completed successfully',
      treatment: this.ToResponseDto(updatedTreatment),
    };
  }

  async cancel(
    id: number,
    userId: number,
    userRole: Role,
    clinicId: number,
  ): Promise<{ message: string }> {
    const existingTreatment = await this.prisma.treatment.findFirst({
      where: { id, clinicId },
    });

    if (!existingTreatment) {
      throw new NotFoundException(
        `Treatment with ID ${id} not found in this clinic`,
      );
    }

    if (userRole !== 'ADMIN' && userRole !== 'DOCTOR') {
      throw new ForbiddenException('Only ADMIN or DOCTOR can cancel treatment');
    }

    if (existingTreatment.status === 'CANCELLED') {
      throw new BadRequestException('Treatment is already cancelled');
    }
    if (existingTreatment.status === 'COMPLETED') {
      throw new BadRequestException('Cannot cancel a completed treatment');
    }

    await this.prisma.$transaction(async (prisma) => {
      const treatment = await prisma.treatment.update({
        where: { id },
        data: { status: 'CANCELLED', endDate: new Date() },
        include: { sessions: true },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'CANCEL_TREATMENT',
          entity: 'Treatment',
          entityId: id.toString(),
          oldValue: JSON.stringify(existingTreatment),
          newValue: JSON.stringify(treatment),
          clinicId,
          ipAddress: null,
          createdAt: new Date(),
        },
      });
    });

    return { message: 'Treatment cancelled successfully' };
  }

  // ============================================================
  // ACTUALIZAR COSTO
  // ============================================================

  async updateCost(
    treatmentId: number,
    costDto: UpdateCostDto,
    userId: number,
    clinicId: number,
  ) {
    const existingTreatment = await this.prisma.treatment.findFirst({
      where: { id: treatmentId, clinicId },
    });

    if (!existingTreatment) {
      throw new NotFoundException(
        `Treatment with ID ${treatmentId} not found`,
      );
    }

    await this.validateUser(userId, clinicId);

    const currentAmountPaid = existingTreatment.amountPaid
      ? Number(existingTreatment.amountPaid)
      : 0;

    const finalAmount = costDto.totalCost - (costDto.discount || 0);
    const newRemaining = finalAmount - currentAmountPaid;

    if (newRemaining < 0) {
      throw new BadRequestException(
        `El descuento no puede ser mayor al costo total. Costo: ${costDto.totalCost}, Pagado: ${currentAmountPaid}`,
      );
    }

    const updatedTreatment = await this.prisma.$transaction(async (prisma) => {
      let paymentStatus: PaymentStatus;
      if (newRemaining <= 0) paymentStatus = 'PAID';
      else if (currentAmountPaid > 0) paymentStatus = 'PARTIAL';
      else paymentStatus = 'UNPAID';

      const treatment = await prisma.treatment.update({
        where: { id: treatmentId },
        data: {
          totalCost: costDto.totalCost,
          discount: costDto.discount || 0,
          finalAmount,
          remainingBalance: newRemaining,
          paymentStatus,
        },
        include: { sessions: true },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_TREATMENT_COST',
          entity: 'Treatment',
          entityId: treatmentId.toString(),
          oldValue: JSON.stringify(existingTreatment),
          newValue: JSON.stringify(treatment),
          clinicId,
          ipAddress: null,
          createdAt: new Date(),
        },
      });

      return treatment;
    });

    return this.ToResponseDto(updatedTreatment);
  }

  // ============================================================
  // REGISTRAR PAGO (idempotencia + lock pesimista)
  // ============================================================

  async registerPayment(
    treatmentId: number,
    dto: RegisterPaymentDto,
    userId: number,
    clinicId: number,
    idempotencyKey?: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    // Validaciones fail-fast fuera de la transacción
    if (dto.amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }
    if (dto.paymentMethod === 'TRANSFER' && !dto.reference?.trim()) {
      throw new BadRequestException(
        'La referencia es obligatoria para transferencias',
      );
    }

    return this.idempotency.run(
      idempotencyKey,
      userId,
      `POST /treatment/${treatmentId}/payment`,
      'POST',
      { treatmentId, ...dto },
      async (tx) => {
        // Lock pesimista: evita race conditions entre pagos concurrentes
        const rows = await tx.$queryRaw<
          Array<{
            id: number;
            totalCost: Prisma.Decimal | null;
            discount: Prisma.Decimal | null;
            amountPaid: Prisma.Decimal | null;
          }>
        >`SELECT id, "totalCost", "discount", "amountPaid"
           FROM "Treatment"
           WHERE id = ${treatmentId} AND "clinicId" = ${clinicId}
           FOR UPDATE`;

        if (rows.length === 0) {
          throw new NotFoundException(`Treatment ${treatmentId} not found`);
        }

        const t = rows[0];
        const finalAmount = Number(t.totalCost ?? 0) - Number(t.discount ?? 0);
        const amountPaid = Number(t.amountPaid ?? 0);
        const remaining = Math.max(0, finalAmount - amountPaid);

        if (remaining <= 0.001) {
          throw new BadRequestException({
            code: 'TREATMENT_ALREADY_PAID',
            message: 'El tratamiento ya está completamente pagado',
          });
        }
        if (dto.amount > remaining + 0.001) {
          throw new BadRequestException({
            code: 'AMOUNT_EXCEEDS_BALANCE',
            message: `El monto excede el saldo pendiente (Bs ${remaining.toFixed(2)})`,
          });
        }

        const payment = await tx.payment.create({
          data: {
            treatmentId,
            clinicId,
            amount: dto.amount,
            paymentMethod: dto.paymentMethod,
            reference: dto.reference?.trim() || null,
            notes: dto.notes?.trim() || null,
            registeredBy: userId,
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
            status: 'ACTIVE',
          },
        });

        await this.recalculateTreatmentPaymentState(tx, treatmentId);

        await tx.auditLog.create({
          data: {
            userId,
            action: 'REGISTER_PAYMENT',
            entity: 'Payment',
            entityId: payment.id.toString(),
            newValue: payment as any,
            clinicId,
            ipAddress: meta?.ipAddress || null,
            createdAt: new Date(),
          },
        });

        return payment;
      },
    );
  }

  // ============================================================
  // ANULAR PAGO (soft delete + auditoría + recálculo)
  // ============================================================

  async voidPayment(
    treatmentId: number,
    paymentId: number,
    dto: VoidPaymentDto,
    userId: number,
    clinicId: number,
  ) {
    const reason = dto.reason?.trim();
    if (!reason || reason.length < 5) {
      throw new BadRequestException(
        'Se requiere un motivo (mínimo 5 caracteres)',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, treatmentId, clinicId },
      });

      if (!payment) {
        throw new NotFoundException(`Payment ${paymentId} not found`);
      }
      if (payment.status === 'VOIDED') {
        throw new BadRequestException({
          code: 'PAYMENT_ALREADY_VOIDED',
          message: 'El pago ya está anulado',
        });
      }

      const voided = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'VOIDED',
          voidedAt: new Date(),
          voidedBy: userId,
          voidReason: reason,
        },
      });

      await this.recalculateTreatmentPaymentState(tx, treatmentId);

      await tx.auditLog.create({
        data: {
          userId,
          action: 'VOID_PAYMENT',
          entity: 'Payment',
          entityId: paymentId.toString(),
          oldValue: payment as any,
          newValue: voided as any,
          clinicId,
          createdAt: new Date(),
        },
      });

      return voided;
    });
  }

  // ============================================================
  // GET PAYMENT STATUS
  // ============================================================

  async getPaymentStatus(treatmentId: number, clinicId: number) {
    const treatment = await this.prisma.treatment.findFirst({
      where: { id: treatmentId, clinicId },
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!treatment) {
      throw new NotFoundException(
        `Treatment with ID ${treatmentId} not found`,
      );
    }

    return {
      treatmentId: treatment.id,
      treatmentName: treatment.name,
      totalCost: treatment.totalCost ? Number(treatment.totalCost) : 0,
      discount: treatment.discount ? Number(treatment.discount) : 0,
      finalAmount: treatment.finalAmount ? Number(treatment.finalAmount) : 0,
      amountPaid: treatment.amountPaid ? Number(treatment.amountPaid) : 0,
      remainingBalance: treatment.remainingBalance
        ? Number(treatment.remainingBalance)
        : 0,
      paymentStatus: treatment.paymentStatus,
      payments: treatment.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod,
        paymentDate: p.paymentDate,
        reference: p.reference,
        notes: p.notes,
        registeredBy: p.user.name,
        registeredById: p.user.id,
        status: p.status,
        voidedAt: p.voidedAt,
        voidedBy: p.voidedBy,
        voidReason: p.voidReason,
      })),
      summary: {
        totalPayments: treatment.payments.length,
        activePayments: treatment.payments.filter((p) => p.status === 'ACTIVE')
          .length,
        totalAmountPaid: treatment.amountPaid
          ? Number(treatment.amountPaid)
          : 0,
        remaining: treatment.remainingBalance
          ? Number(treatment.remainingBalance)
          : 0,
      },
    };
  }
}