import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppointmentResponseDto } from './dto/appointment-response.dto';
import { AppointmentStatus, Role } from '@prisma/client';

@Injectable()
export class AppointmentService {
  constructor(private readonly prisma: PrismaService) { }

  // ==================== MÉTODOS PRIVADOS ====================

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

  private parseDate(dateString: string): Date {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Fecha inválida: ${dateString}. Use formato ISO 8601 (YYYY-MM-DDTHH:mm:ssZ)`);
    }
    return date;
  }

  private async checkAvailability(
    doctorId: number,
    appointmentDate: Date,
    duration: number,
    excludeAppointmentId?: number,
  ): Promise<{ available: boolean; conflict?: any }> {
    const startTime = new Date(appointmentDate);
    const endTime = new Date(startTime.getTime() + duration * 60000);

    // Buscar citas que se superpongan
    const conflictingAppointments = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        appointmentDate: {
          lt: endTime,
        },
        ...(excludeAppointmentId && { id: { not: excludeAppointmentId } }),
      },
    });

    // Verificar superposición
    for (const existing of conflictingAppointments) {
      const existingStart = new Date(existing.appointmentDate);
      const existingEnd = new Date(existingStart.getTime() + existing.duration * 60000);

      // Si hay superposición
      if (startTime < existingEnd && endTime > existingStart) {
        return {
          available: false,
          conflict: {
            id: existing.id,
            startTime: existingStart,
            endTime: existingEnd,
            patientId: existing.patientId,
          },
        };
      }
    }

    return { available: true };
  }

  // ==================== MÉTODOS CRUD ====================

  async create(
    createAppointmentDto: CreateAppointmentDto,
    userId: number,
    clinicId: number,
  ): Promise<AppointmentResponseDto> {
    // 1. Convertir fecha
    const appointmentDate = this.parseDate(createAppointmentDto.appointmentDate);

    // 2.Validación: solo bloquear pasado si NO es retroactiva explícita
    const now = new Date();
    const isRetroactive = createAppointmentDto.allowPastDate === true;

    if (appointmentDate < now && !isRetroactive) {
      throw new BadRequestException(
        'No se pueden crear citas en el pasado. ' +
        'Si estás registrando una atención ya realizada, marcá la opción "registro retroactivo".'
      );
    }

    // 3. Validar que el paciente existe
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: createAppointmentDto.patientId,
        clinicId,
        deletedAt: null,
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${createAppointmentDto.patientId} not found`);
    }

    // 4. Validar que el doctor existe
    const doctor = await this.prisma.user.findFirst({
      where: {
        id: createAppointmentDto.doctorId,
        role: 'DOCTOR',
        clinicId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${createAppointmentDto.doctorId} not found`);
    }

    // 5. Validar duración
    const duration = createAppointmentDto.duration || 30;
    if (duration < 15) {
      throw new BadRequestException('La duración mínima es de 15 minutos');
    }
    if (duration > 120) {
      throw new BadRequestException('La duración máxima es de 120 minutos');
    }

    // 6. Verificar disponibilidad del doctor
    const availability = await this.checkAvailability(
      createAppointmentDto.doctorId,
      appointmentDate,
      duration,
    );

    if (!availability.available) {
      const conflict = availability.conflict;
      const requestedTime = appointmentDate.toLocaleTimeString('es', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const conflictStart = conflict.startTime.toLocaleTimeString('es', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const conflictEnd = conflict.endTime.toLocaleTimeString('es', {
        hour: '2-digit',
        minute: '2-digit',
      });

      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'DOCTOR_UNAVAILABLE',
        message:
          `El doctor no está disponible a las ${requestedTime}. ` +
          `Tiene una cita de ${conflictStart} a ${conflictEnd}.`,
        conflict: {
          startTime: conflict.startTime.toISOString(),
          endTime: conflict.endTime.toISOString(),
        },
      });
    }

    // 7. Crear cita en transacción
    const appointment = await this.prisma.$transaction(async (prisma) => {
      const newAppointment = await prisma.appointment.create({
        data: {
          patientId: createAppointmentDto.patientId,
          doctorId: createAppointmentDto.doctorId,
          appointmentDate: appointmentDate,
          duration: duration,
          reason: createAppointmentDto.reason,
          //diagnosis: createAppointmentDto.diagnosis,
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
              email: true,
            },
          },
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true,
              email: true,
            },
          },
        },
      });

      // Auditoría
      await prisma.auditLog.create({
        data: {
          userId,
          action: isRetroactive ? 'CREATE_RETROACTIVE_APPOINTMENT' : 'CREATE_APPOINTMENT',
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
    startDate?: string;
    endDate?: string;
    status?: string;
    doctorId?: number;
    patientId?: number;
    clinicId: number;
  }): Promise<{ data: AppointmentResponseDto[]; meta: any }> {
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
      status,
      doctorId,
      patientId,
      clinicId,
    } = params;

    const skip = (page - 1) * limit;

    const where: any = { clinicId };

    // Filtros de fecha
    if (startDate && endDate) {
      where.appointmentDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.appointmentDate = { gte: new Date(startDate) };
    } else if (endDate) {
      where.appointmentDate = { lte: new Date(endDate) };
    }

    if (status) where.status = status;
    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;

    const [appointments, total] = await Promise.all([
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
              email: true,
            },
          },
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      data: appointments.map((a) => this.ToResponseDto(a)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: number, clinicId: number): Promise<AppointmentResponseDto> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, clinicId },
      include: {
        patient: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            email: true,
            photoUrl: true,              
            medicalRecordNum: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
            email: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    return this.ToResponseDto(appointment);
  }

  async findByDoctor(
    doctorId: number,
    clinicId: number,
    date?: string,
  ): Promise<AppointmentResponseDto[]> {
    const where: any = {
      doctorId,
      clinicId,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
    };

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
            email: true,
          },
        },
      },
    });

    return appointments.map((a) => this.ToResponseDto(a));
  }

  async findByPatient(
    patientId: number,
    clinicId: number,
  ): Promise<AppointmentResponseDto[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        patientId,
        clinicId,
      },
      orderBy: { appointmentDate: 'asc' },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
            email: true,
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
    // 1. Verificar que existe
    const existingAppointment = await this.prisma.appointment.findFirst({
      where: { id, clinicId },
    });

    if (!existingAppointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    // 2. Validar permisos
    if (userRole === 'RECEPTIONIST' && updateAppointmentDto.status === 'CANCELLED') {
      throw new ForbiddenException('Los recepcionistas no pueden cancelar citas');
    }

    // 3. Preparar datos de actualización
    const updateData: any = {};

    // 3.1 Si cambia la fecha, verificar disponibilidad
    if (updateAppointmentDto.appointmentDate) {
      const appointmentDate = this.parseDate(updateAppointmentDto.appointmentDate);
      const duration = updateAppointmentDto.duration || existingAppointment.duration;
      const doctorId = updateAppointmentDto.doctorId || existingAppointment.doctorId;

      // Verificar disponibilidad
      const availability = await this.checkAvailability(
        doctorId,
        appointmentDate,
        duration,
        id, // Excluir la cita actual
      );

      if (!availability.available) {
        const conflict = availability.conflict;
        throw new BadRequestException(
          `El doctor no está disponible a las ${appointmentDate.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}. ` +
          `Tiene una cita de ${conflict.startTime.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })} ` +
          `a ${conflict.endTime.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`
        );
      }

      updateData.appointmentDate = appointmentDate;
    }

    // 3.2 Asignar otros campos
    if (updateAppointmentDto.patientId !== undefined) updateData.patientId = updateAppointmentDto.patientId;
    if (updateAppointmentDto.doctorId !== undefined) updateData.doctorId = updateAppointmentDto.doctorId;
    if (updateAppointmentDto.duration !== undefined) {
      if (updateAppointmentDto.duration < 15) {
        throw new BadRequestException('La duración mínima es de 15 minutos');
      }
      if (updateAppointmentDto.duration > 120) {
        throw new BadRequestException('La duración máxima es de 120 minutos');
      }
      updateData.duration = updateAppointmentDto.duration;
    }
    if (updateAppointmentDto.reason !== undefined) updateData.reason = updateAppointmentDto.reason;
    //if (updateAppointmentDto.diagnosis !== undefined) updateData.diagnosis = updateAppointmentDto.diagnosis;
    if (updateAppointmentDto.notes !== undefined) updateData.notes = updateAppointmentDto.notes;
    if (updateAppointmentDto.treatmentId !== undefined) updateData.treatmentId = updateAppointmentDto.treatmentId;

    // 4. Actualizar
    const updatedAppointment = await this.prisma.$transaction(async (prisma) => {
      const appointment = await prisma.appointment.update({
        where: { id },
        data: updateData,
        include: {
          patient: {
            select: {
              id: true,
              fullName: true,
              phoneNumber: true,
              email: true,
            },
          },
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true,
              email: true,
            },
          },
        },
      });

      // Auditoría
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_APPOINTMENT',
          entity: 'Appointment',
          entityId: id.toString(),
          oldValue: existingAppointment,
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
    // 1. Verificar que existe
    const existingAppointment = await this.prisma.appointment.findFirst({
      where: { id, clinicId },
    });

    if (!existingAppointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    // 2. Validar estado
    if (existingAppointment.status === 'CANCELLED' && status === 'CANCELLED') {
      throw new BadRequestException('La cita ya está cancelada');
    }

    if (existingAppointment.status === 'COMPLETED' && status === 'CANCELLED') {
      throw new BadRequestException('No se puede cancelar una cita completada');
    }

    if (status === 'CANCELLED' && !cancellationReason) {
      throw new BadRequestException('Se requiere una razón para cancelar la cita');
    }

    // 3. Preparar datos
    const data: any = { status };
    if (status === AppointmentStatus.CANCELLED) {
      data.cancelledAt = new Date();
      data.cancellationReason = cancellationReason;
    }
    if (status === AppointmentStatus.COMPLETED) {
      // Si se completa, actualizar la sesión asociada
      // (se maneja después en la transacción)
    }

    // 4. Actualizar en transacción
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
              email: true,
            },
          },
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true,
              email: true,
            },
          },
        },
      });

      // Si la cita se completa y tiene sesión asociada, completar la sesión
      if (status === AppointmentStatus.COMPLETED) {
        const session = await prisma.treatmentSession.findFirst({
          where: { appointmentId: id },
        });
        if (session) {
          await prisma.treatmentSession.update({
            where: { id: session.id },
            data: { completedAt: new Date() },
          });
        }
      }

      await prisma.auditLog.create({
        data: {
          userId,
          action: `APPOINTMENT_${status}`,
          entity: 'Appointment',
          entityId: id.toString(),
          oldValue: existingAppointment,
          newValue: appointment,
          clinicId: clinicId,
        },
      });

      return appointment;
    });

    return this.ToResponseDto(updatedAppointment);
  }

  async getAvailableSlots(
    doctorId: number,
    clinicId: number,
    date: string,
  ): Promise<string[]> {
    // 1. Validar que el doctor existe
    const doctor = await this.prisma.user.findFirst({
      where: {
        id: doctorId,
        role: 'DOCTOR',
        clinicId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${doctorId} not found`);
    }

    // 2. Configuración de horario laboral (se puede mover a una tabla)
    const workingHours = {
      start: 8, // 8:00 AM
      end: 18,  // 6:00 PM
    };

    const slotDuration = 30; // 30 minutos
    const slots: string[] = [];

    // 3. Obtener citas existentes del día
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

    // 4. Crear set de horarios ocupados
    const bookedSlots = new Set(
      existingAppointments.map((a) => {
        const d = new Date(a.appointmentDate);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }),
    );

    // 5. Generar todos los slots disponibles
    for (let hour = workingHours.start; hour < workingHours.end; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        if (!bookedSlots.has(timeSlot)) {
          slots.push(timeSlot);
        }
      }
    }

    return slots;
  }

  async getTodayAppointments(
    clinicId: number,
    doctorId?: number,
  ): Promise<AppointmentResponseDto[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where: any = {
      clinicId,
      appointmentDate: { gte: today, lt: tomorrow },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
    };

    if (doctorId) {
      where.doctorId = doctorId;
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
            email: true,
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

    return appointments.map((a) => this.ToResponseDto(a));
  }

  async getUpcomingAppointments(
    patientId: number,
    clinicId: number,
  ): Promise<AppointmentResponseDto[]> {
    const now = new Date();

    const appointments = await this.prisma.appointment.findMany({
      where: {
        patientId,
        clinicId,
        appointmentDate: { gt: now },
        status: { notIn: ['CANCELLED', 'NO_SHOW', 'COMPLETED'] },
      },
      orderBy: { appointmentDate: 'asc' },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
            email: true,
          },
        },
      },
      take: 5, // Próximas 5 citas
    });

    return appointments.map((a) => this.ToResponseDto(a));
  }

  async getAppointmentStats(
    clinicId: number,
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    const where: any = { clinicId };

    if (startDate) {
      where.appointmentDate = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.appointmentDate = { ...where.appointmentDate, lte: new Date(endDate) };
    }

    const [total, byStatus, byDoctor] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.appointment.groupBy({
        by: ['doctorId'],
        where,
        _count: true,
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    return {
      total,
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
      topDoctors: byDoctor.map((d) => ({
        doctorId: d.doctorId,
        count: d._count,
      })),
    };
  }

  async remove(id: number, clinicId: number, userId: number): Promise<{ message: string }> {
    const existingAppointment = await this.prisma.appointment.findFirst({
      where: { id, clinicId },
    });

    if (!existingAppointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    await this.prisma.$transaction(async (prisma) => {
      await prisma.appointment.delete({
        where: { id },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'DELETE_APPOINTMENT',
          entity: 'Appointment',
          entityId: id.toString(),
          oldValue: existingAppointment,
          clinicId: clinicId,
        },
      });
    });

    return { message: `Appointment with ID ${id} deleted successfully` };
  }

  async findByTreatment(treatmentId: number, clinicId: number): Promise<AppointmentResponseDto[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        treatmentId: treatmentId,
        clinicId: clinicId,
      },
      include: {
        patient: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            email: true,
            photoUrl: true,
            medicalRecordNum: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
          },
        },
        treatment: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        appointmentDate: 'desc',
      },
    });

    return appointments.map((appointment) => this.ToResponseDto(appointment));
  }
}

