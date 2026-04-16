import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, Put } from '@nestjs/common';
import { TreatmentService } from './treatment.service';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { UpdateTreatmentDto } from './dto/update-treatment.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Patient } from '../patient/entities/patient.entity';


@Controller('treatment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TreatmentController {
  constructor(private readonly treatmentService: TreatmentService) {}

  @Post(':clinicalHistoryId')
  @Roles('ADMIN', 'DOCTOR')
  create(
    @Param('clinicalHistoryId', ParseIntPipe) clinicalHistoryId: number,
    @Body() createTreatmentDto: CreateTreatmentDto,
    @CurrentUser() user: {id: number; role: string; clinicId: number},
  ) {
    return this.treatmentService.create(createTreatmentDto, clinicalHistoryId, user.id, user.clinicId);
  }

  @Get('patient/:patientId')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  findAll(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.treatmentService.findByPatientId(patientId);
  }

  @Get(':id')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  findOne(@Param('id', ParseIntPipe) id: string) {
    return this.treatmentService.findOne(+id);
  }

  @Put(':id')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  update(
    @Param('id', ParseIntPipe) id: string, 
    @Body() updateTreatmentDto: UpdateTreatmentDto,
    @CurrentUser() user: {id: number, role: string; clinicId: number},
  ) {
    return this.treatmentService.update(+id, updateTreatmentDto, user.id, user.clinicId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'DOCTOR')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.treatmentService.cancel(id, user.id, user.role as any, user.clinicId);
  }
}
