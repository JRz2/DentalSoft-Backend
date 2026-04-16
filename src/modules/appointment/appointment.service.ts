import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppointmentResponseDto } from './dto/appointment-response.dto';
import { AppointmentStatus } from '@prisma/client';

@Injectable()
export class AppointmentService {
  constructor(private readonly prisma: PrismaService) {}

  private ToResponseDto(appointment: any): AppointmentResponseDto {
    return {
      id: appointment.id,
      pacientId: appointment.patientId,
      patient: appointment.patient,
      doctorId: appointment.doctorId,
      doctor: appointment.doctor,
      appointmentDate: appointment.appointmentDate,
      duration: appointment.duration,
      status: appointment.status,
      reason: appointment.reason,
      diagnosis: appointment.diagnosis,
      notes: appointment.notes,
      treatmentId: appointment.treatmentId,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
      cancelledAt: appointment.cancelledAt,
      cancellationReason: appointment.cancellationReason,
    };
  }

  private async checkAvailability(
    doctorId: number,
    appointmentDate: Date,
    duration: number,
    excludeAppointmentId?: number,
  ): Promise<boolean> {
    const starTime = new Date(appointmentDate);
    const endTime = new Date(starTime.getTime() + duration * 60000);

    const conflictingAppointments = await this.prisma.appointment.findFirst({
      where: {
        doctorId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        appointmentDate: {
          lt: endTime,
        },
        ...(excludeAppointmentId && { id: { not: excludeAppointmentId } }),
      },
    });

    if (conflictingAppointments) {
      const existingStart = new Date(conflictingAppointments.appointmentDate);
      const existingEnd = new Date(existingStart.getTime() + conflictingAppointments.duration * 60000);

      if (starTime < existingEnd && endTime > existingStart) {
        return false;
      }
    }

    return true;
  }

  async create(createAppointmentDto: CreateAppointmentDto,
    userId: number,
    clinicId: number,
  ): Promise<AppointmentResponseDto> {
    const patient = await this.prisma.patient.findUnique({
      where: { id: createAppointmentDto.patientId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${createAppointmentDto.patientId} not found`);
    }

    const doctor = await this.prisma.user.findUnique({
      where: { id: createAppointmentDto.doctorId, role: 'DOCTOR' },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${createAppointmentDto.doctorId} not found`);
    }

    const duration = createAppointmentDto.duration || 30;
    const isAvailable = await this.checkAvailability(
      createAppointmentDto.doctorId,
      createAppointmentDto.appointmentDate,
      duration,
    );

    if (!isAvailable) {
      throw new NotFoundException(`The doctor is not available at the requested time`);
    }

    const appointment = await this.prisma.$transaction(async (prisma) => {
      const newAppointment = await prisma.appointment.create({
        data: {
          patientId: createAppointmentDto.patientId,
          doctorId: createAppointmentDto.doctorId,
          appointmentDate: createAppointmentDto.appointmentDate,
          duration,
          reason: createAppointmentDto.reason,
          notes: createAppointmentDto.notes,
          treatmentId: createAppointmentDto.treatmentId,
          status: AppointmentStatus.SCHEDULED,
          createdBy: userId,
          clinicId: clinicId,
        },
        include: {
          patient: {
            select: {
              id: true,
              fullName: true,
              phoneNumber: true,
            },
          },
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true,
            },
          },
        },
      });

      if (createAppointmentDto.treatmentId) {
        const treatment = await prisma.treatment.findUnique({
          where: { id: createAppointmentDto.treatmentId },
          include: { sessions: true },
        });

        if (treatment) {
          const nextSessionNumber = treatment.sessions.length + 1;
          await prisma.treatmentSession.create({
            data: {
              treatmentId: createAppointmentDto.treatmentId,
              sessionNumber: nextSessionNumber,
              description: `Session ${nextSessionNumber} for treatment ${treatment.name}`,
              appointmentId: newAppointment.id,
              clinicId: clinicId,
            },
          });
        }
      }

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'CREATE_APPOINTMENT',
          entity: 'Appointment',
          entityId: newAppointment.id.toString(),
          newValue: newAppointment,
          clinicId: clinicId,
        },
      });

      return newAppointment;
    });

    return this.ToResponseDto(appointment);
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    starDate?: string;
    endDate?: string;
    status?: string;
    doctorId?: number;
    patientId?: number;
  }): Promise<{ data: AppointmentResponseDto[]; meta: any }> {
    const { page = 1, limit = 10, starDate, endDate, status, doctorId, patientId } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (starDate && endDate) {
      where.appointmentDate = {};
      if (starDate) { where.appointmentDate.gte = new Date(starDate); }
      if (endDate) { where.appointmentDate.lte = new Date(endDate); }
    }

    if (status)  where.status = status;
    if (doctorId)  where.doctorId = doctorId;
    if (patientId)  where.patientId = patientId; 

    const [appointmets, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { appointmentDate: 'desc' },
        include: {
          patient: {
            select: {
              id: true,
              fullName: true,
              phoneNumber: true,
            },
          },
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true,
            },
          },
        },
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      data: appointmets.map((a) => this.ToResponseDto(a)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },  
    };
  }

  async findOne(id: number): Promise<AppointmentResponseDto> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    return this.ToResponseDto(appointment);
  }

  async findByDoctor(doctorId: number, date?: string): Promise<AppointmentResponseDto[]> {
    const where: any = { doctorId };

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      where.appointmentDate = { gte: startDate, lte: endDate };
    }

    const appointments = await this.prisma.appointment.findMany({
      where,
      orderBy: { appointmentDate: 'asc' },
      include: {
        patient: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
          },
        },
      },
    });

    return appointments.map((a) => this.ToResponseDto(a));
  }

  async findByPatient(patientId: number): Promise<AppointmentResponseDto[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: { patientId },
      orderBy: { appointmentDate: 'asc' },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
          },
        },
      },
    });

    return appointments.map((a) => this.ToResponseDto(a));

  }

  async update(
    id: number, 
    updateAppointmentDto: UpdateAppointmentDto,
    userId: number,
    userRole: string,
    clinicId: number,
  ): Promise<AppointmentResponseDto> {
    await this.findOne(id);

    if(updateAppointmentDto.appointmentDate){
      const duration = updateAppointmentDto.duration || 30;
      const isAvailable = await this.checkAvailability(
        updateAppointmentDto.doctorId || (await this.findOne(id)).doctorId,
        updateAppointmentDto.appointmentDate,
        duration,
        id,
      );

      if (!isAvailable) {
        throw new NotFoundException(`The doctor is not available at the requested time`);
      }
    }

    const updatedAppointment = await this.prisma.$transaction(async (prisma) => {
      const appointment = await prisma.appointment.update({
        where: { id },
        data: updateAppointmentDto,
        include: {
          patient: {
            select: {
              id: true,
              fullName: true,
              phoneNumber: true,
            },
          },
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true,
            },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_APPOINTMENT',
          entity: 'Appointment',
          entityId: id.toString(),
          newValue: appointment,
          clinicId: clinicId,
        },
      });

      return appointment;
    });

    return this.ToResponseDto(updatedAppointment);
  }

  async updateStatus(
    id: number,
    status: AppointmentStatus,
    userId: number,
    userRole: string,
    clinicId: number,
    cancellationReason?: string,
  ): Promise<AppointmentResponseDto> {
    await this.findOne(id);

    const data: any = { status };
    if (status === AppointmentStatus.CANCELLED) {
      data.cancelledAt = new Date();
      data.cancellationReason = cancellationReason;
    }

    const updatedAppointment = await this.prisma.$transaction(async (prisma) => {
      const appointment = await prisma.appointment.update({
        where: { id },
        data: data,
        include: {
          patient: {
            select: {
              id: true,
              fullName: true,
              phoneNumber: true,
            },
          },
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true,
            },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: `APPOINTMENT_${status}`,
          entity: 'Appointment',
          entityId: id.toString(),
          newValue: appointment,
          clinicId: clinicId,
        },
      });

      return appointment;
    });

    return this.ToResponseDto(updatedAppointment);
  }

  async getAvailableSlots(doctorId: number, date: string): Promise<string[]> {

    const doctor = await this.prisma.user.findUnique({
      where: { id: doctorId, role: 'DOCTOR' },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${doctorId} not found`);
    }

    const workingHours = {
      start: 9,
      end: 18,
    };

    const slotDuration = 30;
    const slot: string[] = [];

    const startHour = workingHours.start;
    const endHour = workingHours.end;

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: { gte: startDate, lte: endDate },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
    });

    const bookdSlots = new Set(
      existingAppointments.map((a) => {
        const d = new Date(a.appointmentDate);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }),
    );

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        if (!bookdSlots.has(timeSlot)) {
          slot.push(timeSlot);
        }
      }
    }

    return slot;
  }

  remove(id: number) {
    return `This action removes a #${id} appointment`;
  }
}
