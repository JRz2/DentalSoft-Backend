import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, ParseIntPipe } from '@nestjs/common';
import { PatientService } from './patient.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('patient')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'RECEPTIONIST')
  create(
    @Body() createPatientDto: CreatePatientDto, 
    @CurrentUser() user: { id: number; role: string, clinicId: number },) {
    return this.patientService.create(createPatientDto, user.id, user.role as any, user.clinicId);
  }

  
  @Get()
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  findAll(
    @CurrentUser() user: { clinicId: number; role: string},
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
      return this.patientService.findAll(
      user.clinicId,
      {
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 10,
        search,
      },
      user.role as Role,
    );

    }
  
  @Get(':id')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.patientService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updatePatientDto: UpdatePatientDto,
    @CurrentUser() user: { id: number; role: string, clinicId: number },
  ) {
    return this.patientService.update(id, updatePatientDto, user.id, user.role as any, user.clinicId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string, clinicId: number },) {
    return this.patientService.remove(id, user.id, user.role as any, user.clinicId);
  }
}
