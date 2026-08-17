import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

  private ToResponseDto(treatment: any) {
    return {
      id: treatment.id,
      clinicalHistoryId: treatment.clinicalHistoryId,
      name: treatment.name,
      description: treatment.description,
      type: treatment.type,
      estimatedSessions: treatment.estimatedSessions,
      status: treatment.status,
      starDate: treatment.starDate,
      endDate: treatment.endDate,
      createdAt: treatment.createdAt,
      updatedAt: treatment.updatedAt,
      sessions: treatment.sessions,
      totalCost: treatment.totalCost,
      discount: treatment.discount,
      finalAmount: treatment.finalAmount,
      amountPaid: treatment.amountPaid,
      remainingBalance: treatment.remainingBalance,
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
    const clinicalHistory = await this.prisma.clinicalHistory.findUnique({
      where: { id: clinicalHistoryId },
    });

    if (!clinicalHistory) {
      throw new NotFoundException(`Clinical history with ID ${clinicalHistoryId} not found`);
    }

    const totalCost = createDto.totalCost || 0;
    const paymentAmount = createDto.paymentAmount || 0;

    const hasPayment = paymentAmount > 0 && createDto.paymentMethod;

    const amountPaid = hasPayment ? paymentAmount : 0;
    const remainingBalance = hasPayment ? (totalCost - paymentAmount) : (totalCost || 0);

    let paymentStatus: PaymentStatus;
    if (!totalCost) {
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

      // 4. Auditoría
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'CREATE_TREATMENT',
          entity: 'Treatment',
          entityId: newTreatment.id.toString(),
          newValue: { treatment: newTreatment, payment },
          clinicId: clinicId,
        },
      });

      return { treatment: newTreatment, payment };
    });

    return this.ToResponseDto(result.treatment);
  }

  async findByPatientId(patientId: number): Promise<TreatmentResponseDto[]> {
    const treatments = await this.prisma.treatment.findMany({
      where: {
        clinicalHistory: {
          patientId,
        },
      },
      include: {
        sessions: {
          orderBy: { sessionNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return treatments.map(treatment => this.ToResponseDto(treatment));
  }

  findAll() {
    return `This action returns all treatment`;
  }

  async findOne(id: number): Promise<TreatmentResponseDto> {
    const treatment = await this.prisma.treatment.findUnique({
      where: { id },
      include: {
        clinicalHistory: {
          include: {
            patient: {
              select: {
                id: true,
                fullName: true,
                medicalRecordNum: true,
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
      throw new NotFoundException(`Treatment with ID ${id} not found`);
    }

    return this.ToResponseDto(treatment);
  }

  async update(
    id: number,
    updateDto: UpdateTreatmentDto,
    clinicId: number,
    userId: number): Promise<TreatmentResponseDto> {
    await this.findOne(id);

    const updatedTreatment = await this.prisma.$transaction(async (primsa) => {
      const treatment = await primsa.treatment.update({
        where: { id },
        data: updateDto,
        include: { sessions: true },
      });

      await primsa.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_TREATMENT',
          entity: 'treatment',
          entityId: id.toString(),
          newValue: treatment,
          clinicId: clinicId,
        },
      });

      return treatment;
    });

    return this.ToResponseDto(updatedTreatment);
  }

  async cancel(id: number, userId: number, userRole: Role, clinicId: number): Promise<{ message: string }> {
    await this.findOne(id);

    if (userRole !== 'ADMIN' && userRole !== 'DOCTOR') {
      throw new ForbiddenException('Only ADMNI or DOCTOR can cancel treatment');
    }

    const cancellTreatment = await this.prisma.$transaction(async (prisma) => {
      const treatment = await prisma.treatment.update({
        where: { id },
        data: { status: 'CANCELLED', endDate: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'CANCEL_TREATMEN',
          entity: 'treatment',
          entityId: id.toString(),
          oldValue: treatment,
          clinicId: clinicId,
        },
      });

      return treatment;
    });

    return { message: 'Treatment cancelled successfully' };
  }

  async findAllByClinic(clinicId: number): Promise<TreatmentResponseDto[]> {
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
      orderBy: { id: 'desc' },
    });

    return treatments.map((t) => this.ToResponseDto(t));
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
    const treatment = await this.prisma.treatment.findUnique({
      where: { id: treatmentId },
      include: { payments: true },
    });

    if (!treatment) {
      throw new NotFoundException(`Treatment with ID ${treatmentId} not found`);
    }

    // 2. Verificar que el tratamiento no está cancelado
    if (treatment.status === 'CANCELLED') {
      throw new BadRequestException('No se pueden registrar pagos en un tratamiento cancelado');
    }

    const remaining = treatment.remainingBalance ? Number(treatment.remainingBalance) : 0;

    // 3. Verificar que el monto no exceda lo que falta
    if (paymentDto.amount > remaining) {
      throw new BadRequestException(
        `El monto excede el saldo pendiente: ${remaining}`
      );
    }

    // 4. Registrar el pago en transacción
    const result = await this.prisma.$transaction(async (prisma) => {
      // 4.1 Crear el pago
      const payment = await prisma.payment.create({
        data: {
          treatmentId,
          clinicId,
          amount: paymentDto.amount,
          paymentMethod: paymentDto.paymentMethod,
          reference: paymentDto.reference,
          notes: paymentDto.notes,
          registeredBy: userId,
          ipAddress,
          userAgent,
        },
      });

      // 4.2 Calcular nuevos montos
      const currentAmountPaid = treatment.amountPaid ? Number(treatment.amountPaid) : 0;
      const currentTotalCost = treatment.totalCost ? Number(treatment.totalCost) : 0;

      const newAmountPaid = currentAmountPaid + paymentDto.amount;
      const newRemaining = currentTotalCost - newAmountPaid;

      let paymentStatus: PaymentStatus;

      if (newRemaining <= 0) {
        paymentStatus = 'PAID';
      } else if (newAmountPaid > 0) {
        paymentStatus = 'PARTIAL';
      } else {
        paymentStatus = 'UNPAID';
      }

      // 4.3 Actualizar el tratamiento
      const updatedTreatment = await prisma.treatment.update({
        where: { id: treatmentId },
        data: {
          amountPaid: newAmountPaid,
          remainingBalance: newRemaining,
          paymentStatus: paymentStatus,
        },
      });

      // 4.4 Registrar auditoría
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'REGISTER_PAYMENT',
          entity: 'Treatment',
          entityId: treatmentId.toString(),
          newValue: { payment, treatment: updatedTreatment },
          clinicId,
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
    const existingTreatment = await this.prisma.treatment.findUnique({
      where: { id: treatmentId },
    });

    if (!existingTreatment) {
      throw new NotFoundException(`Treatment with ID ${treatmentId} not found`);
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
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_TREATMENT_COST',
          entity: 'Treatment',
          entityId: treatmentId.toString(),
          newValue: treatment,
          clinicId,
        },
      });

      return treatment;
    });

    return updatedTreatment;
  }

  async getPaymentStatus(treatmentId: number) {
    const treatment = await this.prisma.treatment.findUnique({
      where: { id: treatmentId },
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
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
      })),
      summary: {
        totalPayments: treatment.payments.length,
        totalAmountPaid: treatment.amountPaid ? Number(treatment.amountPaid) : 0,
      },
    };
  }
}
