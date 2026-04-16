import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, Put } from '@nestjs/common';
import { ClinicalHistoryService } from './clinical-history.service';
import { CreateClinicalHistoryDto } from './dto/create-clinical-history.dto';
import { UpdateClinicalHistoryDto } from './dto/update-clinical-history.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('clinical-history')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClinicalHistoryController {
  constructor(private readonly clinicalHistoryService: ClinicalHistoryService) { }

  @Get(':patientId')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  async findByPatientId(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.clinicalHistoryService.findByPatientId(patientId);
  }

  @Put(':patientId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'DOCTOR')
  async update(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Body() updateDto: UpdateClinicalHistoryDto,
    @CurrentUser() user: { id: number; clinicId: number },
  ) {
    return this.clinicalHistoryService.update(
      patientId,
      updateDto,
      user.id,
      user.clinicId,  
    );
  }


  @Post()
  create(@Body() createClinicalHistoryDto: CreateClinicalHistoryDto) {
    return this.clinicalHistoryService.create(createClinicalHistoryDto);
  }

  @Get()
  findAll() {
    return this.clinicalHistoryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clinicalHistoryService.findOne(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clinicalHistoryService.remove(+id);
  }
}
