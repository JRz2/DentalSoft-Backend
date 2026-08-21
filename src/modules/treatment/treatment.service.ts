import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { UpdateTreatmentDto } from './dto/update-treatment.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { TreatmentResponseDto } from './dto/treatment-response.dto';
import { PaymentStatus, Role } from '@prisma/client';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { UpdateCostDto } from './dto/update-cost.dto';

@Injectable()
export class TreatmentService {
  constructor(private readonly prisma: PrismaService) { }

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
      remainingBalance: treatment.remainingBalance ? Number(treatment.remainingBalance) : 0,
      paymentStatus: treatment.paymentStatus,
      patient: treatment.clinicalHistory?.patient ? {
        id: treatment.clinicalHistory.patient.id,
        fullName: treatment.clinicalHistory.patient.fullName,
        phoneNumber: treatment.clinicalHistory.patient.phoneNumber,
        email: treatment.clinicalHistory.patient.email,
        medicalRecordNum: treatment.clinicalHistory.patient.medicalRecordNum,
      } : undefined,
    };
  }

  async create(
    createDto: CreateTreatmentDto,
    clinicalHistoryId: number,
    userId: number,
    clinicId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TreatmentResponseDto> {
    // Validar que la historia clínica existe
    const clinicalHistory = await this.prisma.clinicalHistory.findUnique({
      where: { id: clinicalHistoryId },
    });

    if (!clinicalHistory) {
      throw new NotFoundException(`Clinical history with ID ${clinicalHistoryId} not found`);
    }

    // Validar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId, clinicId },
    });

    if (!user) {
      throw new UnauthorizedException(`User with ID ${userId} not found or doesn't belong to this clinic`);
    }

    const totalCost = createDto.totalCost || 0;
    const paymentAmount = createDto.paymentAmount || 0;

    const hasPayment = paymentAmount > 0 && createDto.paymentMethod;

    const amountPaid = hasPayment ? paymentAmount : 0;
    const remainingBalance = hasPayment ? (totalCost - paymentAmount) : (totalCost || 0);

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
      // 1. Crear tratamiento
      const newTreatment = await prisma.treatment.create({
        data: {
          clinicalHistoryId,
          name: createDto.name,
          description: createDto.description,
          type: createDto.type,
          estimatedSessions: createDto.estimatedSessions,
          status: createDto.status || 'PLANNED',
          clinicId: clinicId,
          totalCost: totalCost,
          discount: 0,
          finalAmount: totalCost || 0,
          amountPaid: amountPaid,
          remainingBalance: remainingBalance,
          paymentStatus: paymentStatus,
          startDate: createDto.startDate || new Date(),
        },
        include: {
          sessions: true,
        },
      });

      let payment: any = null;

      // 2. Registrar pago si hay
      if (hasPayment) {
        if (!createDto.paymentMethod) {
          throw new BadRequestException('El método de pago es requerido');
        }
        payment = await prisma.payment.create({
          data: {
            treatmentId: newTreatment.id,
            clinicId: clinicId,
            amount: paymentAmount,
            paymentMethod: createDto.paymentMethod,
            reference: createDto.paymentReference || null,
            notes: `Pago inicial de ${paymentAmount} al crear el tratamiento`,
            registeredBy: userId,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
          },
        });

        // 3. Si es una sola sesión y está pagado completo, marcar como completado
        if (createDto.estimatedSessions === 1 && remainingBalance <= 0) {
          await prisma.treatment.update({
            where: { id: newTreatment.id },
            data: { status: 'COMPLETED' },
          });
        }
      }

      // 4. Auditoría - AHORA CON TODOS LOS CAMPOS REQUERIDOS
      await prisma.auditLog.create({
        data: {
          userId: userId,
          action: 'CREATE_TREATMENT',
          entity: 'Treatment',
          entityId: newTreatment.id.toString(),
          oldValue: undefined,
          newValue: JSON.stringify({ treatment: newTreatment, payment }),
          clinicId: clinicId,
          ipAddress: ipAddress || null,
          createdAt: new Date(),
        },
      });

      return { treatment: newTreatment, payment };
    });

    return this.ToResponseDto(result.treatment);
  }

  async findByPatientId(patientId: number, clinicId: number): Promise<TreatmentResponseDto[]> {
    const treatments = await this.prisma.treatment.findMany({
      where: {
        clinicalHistory: {
          patientId,
        },
        clinicId, // Filtrar por clínica para multi-tenant
      },
      include: {
        sessions: {
          orderBy: { sessionNumber: 'asc' },
        },
        clinicalHistory: {
          include: {
            patient: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return treatments.map(treatment => this.ToResponseDto(treatment));
  }

  async findAll(clinicId: number): Promise<TreatmentResponseDto[]> {
    const treatments = await this.prisma.treatment.findMany({
      where: { clinicId },
      include: {
        clinicalHistory: {
          include: {
            patient: {
              select: {
                id: true,
                fullName: true,
                medicalRecordNum: true,
              },
            },
          },
        },
        sessions: {
          orderBy: { sessionNumber: 'asc' },
          include: {
            appointment: {
              select: {
                id: true,
                appointmentDate: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return treatments.map(treatment => this.ToResponseDto(treatment));
  }

  async findOne(id: number, clinicId: number): Promise<TreatmentResponseDto> {
    const treatment = await this.prisma.treatment.findFirst({
      where: {
        id,
        clinicId, // IMPORTANTE: Validar que pertenece a la clínica
      },
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
              }
            }
          }
        },
        sessions: {
          orderBy: { sessionNumber: 'asc' },
          include: {
            appointment: {
              select: {
                id: true,
                appointmentDate: true,
                status: true,
              }
            }
          }
        }
      }
    });

    if (!treatment) {
      throw new NotFoundException(`Treatment with ID ${id} not found in this clinic`);
    }

    return this.ToResponseDto(treatment);
  }

  async update(
    id: number,
    updateDto: UpdateTreatmentDto,
    clinicId: number,
    userId: number
  ): Promise<TreatmentResponseDto> {
    // 1. Verificar que el tratamiento existe y pertenece a la clínica
    const existingTreatment = await this.prisma.treatment.findFirst({
      where: {
        id,
        clinicId,
      },
    });

    if (!existingTreatment) {
      throw new NotFoundException(`Treatment with ID ${id} not found in this clinic`);
    }

    // 2. Verificar que el usuario existe y pertenece a la clínica
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
        clinicId,
      },
    });

    if (!user) {
      throw new UnauthorizedException(`User with ID ${userId} not found or doesn't belong to this clinic`);
    }

    // 3. Actualizar en transacción
    const updatedTreatment = await this.prisma.$transaction(async (prisma) => {
      // Preparar datos de actualización - solo campos permitidos
      const updateData: any = {};

      if (updateDto.name !== undefined) updateData.name = updateDto.name;
      if (updateDto.description !== undefined) updateData.description = updateDto.description;
      if (updateDto.type !== undefined) updateData.type = updateDto.type;
      if (updateDto.estimatedSessions !== undefined) updateData.estimatedSessions = updateDto.estimatedSessions;
      if (updateDto.status !== undefined) updateData.status = updateDto.status;
      if (updateDto.startDate !== undefined) updateData.startDate = updateDto.startDate;
      if (updateDto.endDate !== undefined) updateData.endDate = updateDto.endDate;

      // NO permitir actualizar campos calculados
      // totalCost, discount, finalAmount, amountPaid, remainingBalance, paymentStatus
      // se actualizan SOLO a través de métodos específicos (updateCost, registerPayment)

      // Actualizar el tratamiento
      const treatment = await prisma.treatment.update({
        where: { id },
        data: updateData,
        include: {
          sessions: true,
          clinicalHistory: {
            include: {
              patient: true,
            },
          },
        },
      });

      // 4. Crear audit log - AHORA CON TODOS LOS CAMPOS REQUERIDOS
      await prisma.auditLog.create({
        data: {
          userId: userId,
          action: 'UPDATE_TREATMENT',
          entity: 'Treatment',
          entityId: id.toString(),
          oldValue: JSON.stringify(existingTreatment),
          newValue: JSON.stringify(treatment),
          clinicId: clinicId,
          ipAddress: null,
          createdAt: new Date(),
        },
      });

      return treatment;
    });

    return this.ToResponseDto(updatedTreatment);
  }

  async cancel(
    id: number,
    userId: number,
    userRole: Role,
    clinicId: number
  ): Promise<{ message: string }> {
    // 1. Verificar que el tratamiento existe
    const existingTreatment = await this.prisma.treatment.findFirst({
      where: { id, clinicId },
    });

    if (!existingTreatment) {
      throw new NotFoundException(`Treatment with ID ${id} not found in this clinic`);
    }

    // 2. Validar permisos
    if (userRole !== 'ADMIN' && userRole !== 'DOCTOR') {
      throw new ForbiddenException('Only ADMIN or DOCTOR can cancel treatment');
    }

    // 3. Validar que no esté ya cancelado o completado
    if (existingTreatment.status === 'CANCELLED') {
      throw new BadRequestException('Treatment is already cancelled');
    }

    if (existingTreatment.status === 'COMPLETED') {
      throw new BadRequestException('Cannot cancel a completed treatment');
    }

    // 4. Cancelar en transacción
    const cancelledTreatment = await this.prisma.$transaction(async (prisma) => {
      const treatment = await prisma.treatment.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          endDate: new Date()
        },
        include: {
          sessions: true,
        },
      });

      // 5. Auditoría
      await prisma.auditLog.create({
        data: {
          userId: userId,
          action: 'CANCEL_TREATMENT',
          entity: 'Treatment',
          entityId: id.toString(),
          oldValue: JSON.stringify(existingTreatment),
          newValue: JSON.stringify(treatment),
          clinicId: clinicId,
          ipAddress: null,
          createdAt: new Date(),
        },
      });

      return treatment;
    });

    return { message: 'Treatment cancelled successfully' };
  }

  async registerPayment(
    treatmentId: number,
    paymentDto: RegisterPaymentDto,
    userId: number,
    clinicId: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // 1. Verificar que el tratamiento existe
    const treatment = await this.prisma.treatment.findFirst({
      where: {
        id: treatmentId,
        clinicId,
      },
      include: { payments: true },
    });

    if (!treatment) {
      throw new NotFoundException(`Treatment with ID ${treatmentId} not found`);
    }

    // 2. Verificar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId, clinicId },
    });

    if (!user) {
      throw new UnauthorizedException(`User with ID ${userId} not found or doesn't belong to this clinic`);
    }

    // 3. Verificar que el tratamiento no está cancelado
    if (treatment.status === 'CANCELLED') {
      throw new BadRequestException('No se pueden registrar pagos en un tratamiento cancelado');
    }

    const remaining = treatment.remainingBalance ? Number(treatment.remainingBalance) : 0;

    // 4. Verificar que el monto no exceda lo que falta
    if (paymentDto.amount > remaining) {
      throw new BadRequestException(
        `El monto excede el saldo pendiente: ${remaining}`
      );
    }

    // 5. Registrar el pago en transacción
    const result = await this.prisma.$transaction(async (prisma) => {
      // 5.1 Crear el pago
      const payment = await prisma.payment.create({
        data: {
          treatmentId,
          clinicId,
          amount: paymentDto.amount,
          paymentMethod: paymentDto.paymentMethod,
          reference: paymentDto.reference,
          notes: paymentDto.notes,
          registeredBy: userId,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      // 5.2 Calcular nuevos montos
      const currentAmountPaid = treatment.amountPaid ? Number(treatment.amountPaid) : 0;
      const currentTotalCost = treatment.totalCost ? Number(treatment.totalCost) : 0;
      const currentDiscount = treatment.discount ? Number(treatment.discount) : 0;
      const currentFinalAmount = treatment.finalAmount ? Number(treatment.finalAmount) : currentTotalCost - currentDiscount;

      const newAmountPaid = currentAmountPaid + paymentDto.amount;
      const newRemaining = currentFinalAmount - newAmountPaid;

      let paymentStatus: PaymentStatus;

      if (newRemaining <= 0) {
        paymentStatus = 'PAID';
      } else if (newAmountPaid > 0) {
        paymentStatus = 'PARTIAL';
      } else {
        paymentStatus = 'UNPAID';
      }

      // 5.3 Actualizar el tratamiento
      const updatedTreatment = await prisma.treatment.update({
        where: { id: treatmentId },
        data: {
          amountPaid: newAmountPaid,
          remainingBalance: newRemaining,
          paymentStatus: paymentStatus,
        },
        include: {
          sessions: true,
        },
      });

      // 5.4 Registrar auditoría
      await prisma.auditLog.create({
        data: {
          userId: userId,
          action: 'REGISTER_PAYMENT',
          entity: 'Treatment',
          entityId: treatmentId.toString(),
          oldValue: JSON.stringify(treatment),
          newValue: JSON.stringify({ payment, treatment: updatedTreatment }),
          clinicId: clinicId,
          ipAddress: ipAddress || null,
          createdAt: new Date(),
        },
      });

      return { payment, treatment: updatedTreatment };
    });

    return {
      message: 'Pago registrado exitosamente',
      payment: result.payment,
      treatment: {
        id: result.treatment.id,
        totalCost: result.treatment.totalCost,
        amountPaid: result.treatment.amountPaid,
        remainingBalance: result.treatment.remainingBalance,
        paymentStatus: result.treatment.paymentStatus,
      },
    };
  }

  async updateCost(
    treatmentId: number,
    costDto: UpdateCostDto,
    userId: number,
    clinicId: number,
  ) {
    // 1. Verificar que el tratamiento existe
    const existingTreatment = await this.prisma.treatment.findFirst({
      where: {
        id: treatmentId,
        clinicId,
      },
    });

    if (!existingTreatment) {
      throw new NotFoundException(`Treatment with ID ${treatmentId} not found`);
    }

    // 2. Verificar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId, clinicId },
    });

    if (!user) {
      throw new UnauthorizedException(`User with ID ${userId} not found or doesn't belong to this clinic`);
    }

    const currentAmountPaid = existingTreatment.amountPaid
      ? Number(existingTreatment.amountPaid)
      : 0;

    const finalAmount = costDto.totalCost - (costDto.discount || 0);
    const newRemaining = finalAmount - currentAmountPaid;

    if (newRemaining < 0) {
      throw new BadRequestException(
        `El descuento no puede ser mayor al costo total. Costo: ${costDto.totalCost}, Pagado: ${currentAmountPaid}`
      );
    }

    // 3. Actualizar en transacción
    const updatedTreatment = await this.prisma.$transaction(async (prisma) => {
      let paymentStatus: PaymentStatus;
      if (newRemaining <= 0) {
        paymentStatus = 'PAID';
      } else if (currentAmountPaid > 0) {
        paymentStatus = 'PARTIAL';
      } else {
        paymentStatus = 'UNPAID';
      }

      const treatment = await prisma.treatment.update({
        where: { id: treatmentId },
        data: {
          totalCost: costDto.totalCost,
          discount: costDto.discount || 0,
          finalAmount: finalAmount,
          remainingBalance: newRemaining,
          paymentStatus: paymentStatus,
        },
        include: {
          sessions: true,
        },
      });

      // 4. Auditoría
      await prisma.auditLog.create({
        data: {
          userId: userId,
          action: 'UPDATE_TREATMENT_COST',
          entity: 'Treatment',
          entityId: treatmentId.toString(),
          oldValue: JSON.stringify(existingTreatment),
          newValue: JSON.stringify(treatment),
          clinicId: clinicId,
          ipAddress: null,
          createdAt: new Date(),
        },
      });

      return treatment;
    });

    return this.ToResponseDto(updatedTreatment);
  }

  async getPaymentStatus(treatmentId: number, clinicId: number) {
    const treatment = await this.prisma.treatment.findFirst({
      where: {
        id: treatmentId,
        clinicId,
      },
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!treatment) {
      throw new NotFoundException(`Treatment with ID ${treatmentId} not found`);
    }

    return {
      treatmentId: treatment.id,
      treatmentName: treatment.name,
      totalCost: treatment.totalCost ? Number(treatment.totalCost) : 0,
      discount: treatment.discount ? Number(treatment.discount) : 0,
      finalAmount: treatment.finalAmount ? Number(treatment.finalAmount) : 0,
      amountPaid: treatment.amountPaid ? Number(treatment.amountPaid) : 0,
      remainingBalance: treatment.remainingBalance ? Number(treatment.remainingBalance) : 0,
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
      })),
      summary: {
        totalPayments: treatment.payments.length,
        totalAmountPaid: treatment.amountPaid ? Number(treatment.amountPaid) : 0,
        remaining: treatment.remainingBalance ? Number(treatment.remainingBalance) : 0,
      },
    };
  }

  async complete(
    id: number,
    userId: number,
    userRole: Role,
    clinicId: number,
  ): Promise<{ message: string; treatment: TreatmentResponseDto }> {
    // 1. Verificar que el tratamiento existe
    const treatment = await this.prisma.treatment.findFirst({
      where: {
        id,
        clinicId,
      },
    });

    if (!treatment) {
      throw new NotFoundException(`Treatment with ID ${id} not found`);
    }

    // 2. Validar permisos
    if (userRole !== 'ADMIN' && userRole !== 'DOCTOR') {
      throw new ForbiddenException('Only ADMIN or DOCTOR can complete treatments');
    }

    // 3. Validar que el tratamiento no esté ya completado o cancelado
    if (treatment.status === 'COMPLETED') {
      throw new BadRequestException('Treatment is already completed');
    }

    if (treatment.status === 'CANCELLED') {
      throw new BadRequestException('Cannot complete a cancelled treatment');
    }

    // 4. Actualizar el tratamiento a COMPLETED
    const updatedTreatment = await this.prisma.$transaction(async (prisma) => {
      const updated = await prisma.treatment.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          endDate: new Date(),
        },
        include: {
          clinicalHistory: {
            include: {
              patient: {
                select: {
                  id: true,
                  fullName: true,
                  medicalRecordNum: true,
                },
              },
            },
          },
          sessions: true,
        },
      });

      // 5. Registrar auditoría
      await prisma.auditLog.create({
        data: {
          userId: userId,
          action: 'COMPLETE_TREATMENT',
          entity: 'Treatment',
          entityId: id.toString(),
          oldValue: JSON.stringify(treatment),
          newValue: JSON.stringify(updated),
          clinicId: clinicId,
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

  // Método auxiliar para verificar existencia de usuario
  private async validateUser(userId: number, clinicId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
        clinicId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new UnauthorizedException(`User with ID ${userId} not found or doesn't belong to this clinic`);
    }
  }

  // Método auxiliar para verificar existencia de tratamiento
  private async validateTreatment(id: number, clinicId: number): Promise<any> {
    const treatment = await this.prisma.treatment.findFirst({
      where: { id, clinicId },
    });

    if (!treatment) {
      throw new NotFoundException(`Treatment with ID ${id} not found in this clinic`);
    }

    return treatment;
  }
}