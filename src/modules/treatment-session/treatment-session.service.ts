import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTreatmentSessionDto } from './dto/create-treatment-session.dto';
import { UpdateTreatmentSessionDto } from './dto/update-treatment-session.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { TreatmentSessionResponseDto } from './dto/treatment-session-response.dto';
import { Role } from '@prisma/client';

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
    const session = await this.findOne(id);

    if (userRole !== 'ADMIN' && userRole !== 'DOCTOR') {
      throw new ForbiddenException('Only ADMIN or DOCTOR can complete sessions');
    }

    const updatedSession = await this.prisma.$transaction(async (prisma) => {
      const completedSession = await prisma.treatmentSession.update({
        where: { id },
        data: { completedAt: new Date() },
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

      const treatmentSession = await prisma.treatmentSession.findMany({
        where: { treatmentId: session.treatmentId },
      });

      const allCompleted = treatmentSession.every(s => s.completedAt !== null);
      const lastSession = treatmentSession.length === session.sessionNumber;

      if (allCompleted && lastSession) {
        await prisma.treatment.update({
          where: { id: session.treatmentId },
          data: { status: 'COMPLETED', endDate: new Date() },
        });
      }

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'COMPLETE_TREATMENT_SESSION',
          entity: 'TreatmentSession',
          entityId: id.toString(),
          newValue: completedSession,
          clinicId: clinicId,
        }
      });

      return completedSession;
    });

    return this.ToResponseDto(updatedSession);
  }

  remove(id: number) {
    return `This action removes a #${id} treatmentSession`;
  }
}
