import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTreatmentSessionDto } from './dto/create-treatment-session.dto';
import { UpdateTreatmentSessionDto } from './dto/update-treatment-session.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { TreatmentSessionResponseDto } from './dto/treatment-session-response.dto';
import { Role } from '@prisma/client';
import { format } from 'date-fns';

@Injectable()
export class TreatmentSessionService {
  constructor(private readonly prisma: PrismaService) { }

  private ToResponseDto(session: any) {
    return {
      id: session.id,
      treatmentId: session.treatmentId,
      sessionNumber: session.sessionNumber,
      description: session.description,
      notes: session.notes,
      procedures: session.procedures,
      appointmentId: session.appointmentId,
      sessionDate: session.sessionDate,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      appointment: session.appointment,
    }
  }

  async create(
    createTreatmentSessionDto: CreateTreatmentSessionDto,
    userId: number,
    clinicId: number,
  ): Promise<TreatmentSessionResponseDto> {
    const treatment = await this.prisma.treatment.findUnique({
      where: { id: createTreatmentSessionDto.treatmentId },
    });

    if (!treatment) {
      throw new NotFoundException(`Treatment with ID ${createTreatmentSessionDto.treatmentId} not found`);
    }

    if (createTreatmentSessionDto.appointmentId) {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: createTreatmentSessionDto.appointmentId },
      });

      if (!appointment) {
        throw new NotFoundException(`Appointment with ID ${createTreatmentSessionDto.appointmentId} not found`);
      }
    }

    const existingSessions = await this.prisma.treatmentSession.findFirst({
      where: {
        treatmentId: createTreatmentSessionDto.treatmentId,
        sessionNumber: createTreatmentSessionDto.sessionNumber,
      },
    });

    if (existingSessions) {
      throw new ForbiddenException(`A treatment session with number ${createTreatmentSessionDto.sessionNumber} already exists for this treatment`);
    }

    const sessionData: any = {
      treatmentId: createTreatmentSessionDto.treatmentId,
      sessionNumber: createTreatmentSessionDto.sessionNumber,
      description: createTreatmentSessionDto.description,
      notes: createTreatmentSessionDto.notes,
      procedures: createTreatmentSessionDto.procedures,
      sessionDate: createTreatmentSessionDto.sessionDate
        ? new Date(createTreatmentSessionDto.sessionDate)
        : new Date(),
      clinicId,
    };

    if (createTreatmentSessionDto.appointmentId) {
      sessionData.appointmentId = createTreatmentSessionDto.appointmentId;
    }

    const session = await this.prisma.$transaction(async (prisma) => {
      const newSession = await prisma.treatmentSession.create({
        data: sessionData,
        include: {
          appointment: {
            select: {
              id: true,
              appointmentDate: true,
              status: true,
            },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'CREATE_TREATMENT_SESSION',
          entity: 'TreatmentSession',
          entityId: newSession.id.toString(),
          newValue: newSession,
          clinicId: clinicId,
        }
      });

      return newSession;
    });

    return this.ToResponseDto(session);
  }

  async findByTreatmentId(treatmentId: number): Promise<TreatmentSessionResponseDto[]> {
    const sessions = await this.prisma.treatmentSession.findMany({
      where: { treatmentId },
      include: {
        appointment: {
          select: {
            id: true,
            appointmentDate: true,
            status: true,
          },
        },
      },
      orderBy: { sessionNumber: 'asc' },
    });

    return sessions.map(session => this.ToResponseDto(session));
  }

  async findOne(id: number): Promise<TreatmentSessionResponseDto> {
    const session = await this.prisma.treatmentSession.findUnique({
      where: { id },
      include: {
        treatment: {
          include: {
            clinicalHistory: {
              include: {
                patient: true,
              },
            },
          },
        },
        appointment: true,
      },
    });

    if (!session) {
      throw new NotFoundException('treatment session with ID ${id} not found');
    }
    return this.ToResponseDto(session);
  }

  async update(
    id: number,
    updateTreatmentSessionDto: UpdateTreatmentSessionDto,
    userId: number,
    clinicId: number,
  ): Promise<TreatmentSessionResponseDto> {
    await this.findOne(id);

    const updatedSession = await this.prisma.$transaction(async (prisma) => {
      const session = await prisma.treatmentSession.update({
        where: { id },
        data: updateTreatmentSessionDto,
        include: {
          appointment: {
            select: {
              id: true,
              appointmentDate: true,
              status: true,
            },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_TREATMENT_SESSION',
          entity: 'TreatmentSession',
          entityId: session.id.toString(),
          newValue: session,
          clinicId: clinicId,
        }
      });

      return session;
    });

    return this.ToResponseDto(updatedSession);
  }

  async complete(
    id: number,
    userId: number,
    userRole: Role,
    clinicId: number,
  ): Promise<TreatmentSessionResponseDto> {
    if (userRole !== 'ADMIN' && userRole !== 'DOCTOR') {
      throw new ForbiddenException('Only ADMIN or DOCTOR can complete sessions');
    }

    const session = await this.findOne(id);

    if (session.status === 'COMPLETED') {
      throw new BadRequestException('La sesión ya está completada');
    }

    const updatedSession = await this.prisma.$transaction(async (prisma) => {
      // 1. Marcar la sesión como completada
      const completedSession = await prisma.treatmentSession.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
        include: {
          appointment: {
            select: {
              id: true,
              appointmentDate: true,
              status: true,
            },
          },
        },
      });

      // 2. Verificar si el tratamiento debe cerrarse
      const treatment = await prisma.treatment.findUnique({
        where: { id: session.treatmentId },
      });

      const sessions = await prisma.treatmentSession.findMany({
        where: { treatmentId: session.treatmentId },
        select: { status: true, sessionNumber: true },
      });

      const allCompleted = sessions.every((s) => s.status === 'COMPLETED');
      const isLastPlanned =
        session.sessionNumber >= (treatment?.estimatedSessions ?? session.sessionNumber);

      if (allCompleted && isLastPlanned && treatment?.status !== 'COMPLETED') {
        await prisma.treatment.update({
          where: { id: session.treatmentId },
          data: { status: 'COMPLETED', endDate: new Date() },
        });
      }

      // 3. Auditoría
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'COMPLETE_TREATMENT_SESSION',
          entity: 'TreatmentSession',
          entityId: id.toString(),
          newValue: completedSession,
          clinicId,
        },
      });

      return completedSession;
    });

    return this.ToResponseDto(updatedSession);
  }

  async noShow(
    id: number,
    userId: number,
    userRole: Role,
    clinicId: number,
    reason?: string,
  ): Promise<TreatmentSessionResponseDto> {
    if (userRole !== 'ADMIN' && userRole !== 'DOCTOR') {
      throw new ForbiddenException('Only ADMIN or DOCTOR can mark no-show sessions');
    }

    const session = await this.findOne(id);

    if (session.status === 'COMPLETED') {
      throw new BadRequestException('No se puede marcar como no asistida una sesión completada');
    }
    if (session.status === 'NO_SHOW') {
      throw new BadRequestException('La sesión ya está marcada como no asistida');
    }

    const trimmedReason = reason?.trim();
    const noShowBlock = trimmedReason
      ? `No asistió: ${trimmedReason}`
      : 'No asistió';

    const finalNotes = session.notes?.trim()
      ? `${session.notes.trim()}\n\n${noShowBlock}`
      : noShowBlock;

    const updatedSession = await this.prisma.$transaction(async (prisma) => {
      const noShowSession = await prisma.treatmentSession.update({
        where: { id },
        data: {
          status: 'NO_SHOW',
          notes: finalNotes,
        },
        include: {
          appointment: {
            select: { id: true, appointmentDate: true, status: true },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'NO_SHOW_TREATMENT_SESSION',
          entity: 'TreatmentSession',
          entityId: id.toString(),
          newValue: noShowSession,
          clinicId,
        },
      });

      return noShowSession;
    });

    return this.ToResponseDto(updatedSession);
  }

  async revert(
    id: number,
    userId: number,
    userRole: Role,
    clinicId: number,
  ): Promise<TreatmentSessionResponseDto> {
    if (userRole !== 'ADMIN') {
      throw new ForbiddenException('Only ADMIN can revert session status');
    }

    const session = await this.findOne(id);

    if (session.status === 'PENDING') {
      throw new BadRequestException('La sesión ya está pendiente');
    }

    const updatedSession = await this.prisma.$transaction(async (prisma) => {
      const reverted = await prisma.treatmentSession.update({
        where: { id },
        data: { status: 'PENDING', completedAt: null },
      });

      // Si el tratamiento estaba COMPLETED, volver a IN_PROGRESS
      const treatment = await prisma.treatment.findUnique({
        where: { id: session.treatmentId },
      });
      if (treatment?.status === 'COMPLETED') {
        await prisma.treatment.update({
          where: { id: session.treatmentId },
          data: { status: 'IN_PROGRESS', endDate: null },
        });
      }

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'REVERT_TREATMENT_SESSION',
          entity: 'TreatmentSession',
          entityId: id.toString(),
          newValue: reverted,
          clinicId,
        },
      });

      return reverted;
    });

    return this.ToResponseDto(updatedSession);
  }

  remove(id: number) {
    return `This action removes a #${id} treatmentSession`;
  }
}
