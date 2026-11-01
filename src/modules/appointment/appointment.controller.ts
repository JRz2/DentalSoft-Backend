import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe, UseGuards, BadRequestException,
} from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AppointmentStatus } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PrismaService } from 'src/prisma/prisma.service';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService, private readonly prisma: PrismaService) { }


  @Post()
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Crear una nueva cita' })
  async create(
    @Body() createAppointmentDto: CreateAppointmentDto,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    // Verificar si el doctor existe
    const doctorExists = await this.prisma.user.findUnique({
      where: { id: createAppointmentDto.doctorId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        clinicId: true,
        isActive: true,
      }
    });
    console.log('📌 Doctor encontrado en BD:', doctorExists);

    // Verificar si existe en la clínica correcta
    const doctorInClinic = await this.prisma.user.findFirst({
      where: {
        id: createAppointmentDto.doctorId,
        clinicId: user.clinicId,
        role: 'DOCTOR',
      },
      select: {
        id: true,
        name: true,
        role: true,
        clinicId: true,
      }
    });
    console.log('📌 Doctor en clínica correcta:', doctorInClinic);

    return this.appointmentService.create(
      createAppointmentDto,
      user.id,
      user.clinicId,
    );
  }

  @Get()
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener todas las citas con filtros' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'startDate', required: false, example: '2024-07-01T00:00:00.000Z' })
  @ApiQuery({ name: 'endDate', required: false, example: '2024-07-31T23:59:59.999Z' })
  @ApiQuery({ name: 'status', required: false, enum: AppointmentStatus })
  @ApiQuery({ name: 'doctorId', required: false, type: Number })
  @ApiQuery({ name: 'patientId', required: false, type: Number })
  async findAll(
    @CurrentUser() user: { id: number; role: string; clinicId: number },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: AppointmentStatus,
    @Query('doctorId') doctorId?: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.appointmentService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      startDate: startDate,
      endDate: endDate,
      status: status,
      doctorId: doctorId ? parseInt(doctorId, 10) : undefined,
      patientId: patientId ? parseInt(patientId, 10) : undefined,
      clinicId: user.clinicId,
    });
  }

  @Get('available-slots')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener horarios disponibles de un doctor' })
  @ApiQuery({ name: 'doctorId', required: true, type: Number })
  @ApiQuery({ name: 'date', required: true, example: '2024-07-01' })
  async getAvailableSlots(
    @Query('doctorId') doctorId: string,
    @Query('date') date: string,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.appointmentService.getAvailableSlots(
      parseInt(doctorId, 10),
      user.clinicId,
      date,
    );
  }

  @Get('doctor/:doctorId')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener citas de un doctor' })
  @ApiQuery({ name: 'date', required: false, example: '2024-07-01' })
  async findByDoctor(
    @CurrentUser() user: { id: number; role: string; clinicId: number },
    @Param('doctorId', ParseIntPipe) doctorId: number,
    @Query('date') date?: string,
  ) {
    return this.appointmentService.findByDoctor(
      doctorId,
      user.clinicId,
      date,
    );
  }

  @Get('patient/:patientId')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener citas de un paciente' })
  async findByPatient(
    @Param('patientId', ParseIntPipe) patientId: number,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.appointmentService.findByPatient(
      patientId,
      user.clinicId,
    );
  }

  @Get('today')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener citas de hoy' })
  @ApiQuery({ name: 'doctorId', required: false, type: Number })
  async getTodayAppointments(
    @CurrentUser() user: { id: number; role: string; clinicId: number },
    @Query('doctorId') doctorId?: string,
  ) {
    return this.appointmentService.getTodayAppointments(
      user.clinicId,
      doctorId ? parseInt(doctorId, 10) : undefined,
    );
  }

  @Get('upcoming')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener próximas citas de un paciente' })
  @ApiQuery({ name: 'patientId', required: true, type: Number })
  async getUpcomingAppointments(
    @Query('patientId') patientId: string,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.appointmentService.getUpcomingAppointments(
      parseInt(patientId, 10),
      user.clinicId,
    );
  }

  @Get('stats')
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Obtener estadísticas de citas' })
  @ApiQuery({ name: 'startDate', required: false, example: '2024-07-01T00:00:00.000Z' })
  @ApiQuery({ name: 'endDate', required: false, example: '2024-07-31T23:59:59.999Z' })
  async getAppointmentStats(
    @CurrentUser() user: { id: number; role: string; clinicId: number },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.appointmentService.getAppointmentStats(
      user.clinicId,
      startDate,
      endDate,
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener una cita por ID' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.appointmentService.findOne(
      id,
      user.clinicId,
    );
  }

  @Patch(':id')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Actualizar una cita' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.appointmentService.update(
      id,
      updateAppointmentDto,
      user.id,
      user.role,
      user.clinicId,
    );
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Actualizar estado de una cita' })
  async updateStatus(
    @CurrentUser() user: { id: number; role: string; clinicId: number },
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: AppointmentStatus,
    @Body('cancellationReason') cancellationReason?: string,
  ) {
    if (!status) {
      throw new BadRequestException('El estado es requerido');
    }

    // Validar que el estado sea válido
    const validStatuses = Object.values(AppointmentStatus);
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Estado inválido. Valores permitidos: ${validStatuses.join(', ')}`);
    }

    return this.appointmentService.updateStatus(
      id,
      status,
      user.id,
      user.role,
      user.clinicId,
      cancellationReason,
    );
  }

  @Delete(':id')
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Eliminar una cita (hard delete)' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.appointmentService.remove(
      id,
      user.clinicId,
      user.id,
    );
  }

  @Get('treatment/:treatmentId')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  findByTreatment(
    @Param('treatmentId', ParseIntPipe) treatmentId: number,
    @CurrentUser() user: { clinicId: number },
  ) {
    return this.appointmentService.findByTreatment(treatmentId, user.clinicId);
  }
}