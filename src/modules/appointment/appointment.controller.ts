import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, ParseIntPipe, Put } from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AvailableSlotsDto } from './dto/available-slots.dto';
import { AppointmentStatus } from '@prisma/client';

@Controller('appointment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  create(
    @Body() createAppointmentDto: CreateAppointmentDto,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ){
    return this.appointmentService.create(createAppointmentDto, user.id, user.clinicId);
  }

  @Get()
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('doctorId') doctorId?: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.appointmentService.findAll({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      starDate:
      endDate,
      status,
      doctorId: doctorId ? parseInt(doctorId) : undefined,
      patientId: patientId ? parseInt(patientId) : undefined,
    });
  }

  @Get('available-slots')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  getAvailableSlots(@Query() query: AvailableSlotsDto) {
    return this.appointmentService.getAvailableSlots(query.doctorId, query.date);
  }

  @Get('doctor/:doctorId')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  findByDoctor(
    @Param('doctorId', ParseIntPipe) doctorId: number,
    @Query('date') date?: string,
  ) {
    return this.appointmentService.findByDoctor(doctorId, date);
  }

  @Get('patient/:patientId')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  findByPatient(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.appointmentService.findByPatient(patientId);
  }

  @Get(':id')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentService.findOne(id);
  }

  @Put(':id')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateAppointmentDto,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.appointmentService.update(id, updateDto, user.id, user.role as any, user.clinicId);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: AppointmentStatus,
    @Body('cancellationReason') cancellationReason: string,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.appointmentService.updateStatus(id, status, user.id, user.role as any, user.clinicId, cancellationReason);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.appointmentService.remove(+id);
  }
}
