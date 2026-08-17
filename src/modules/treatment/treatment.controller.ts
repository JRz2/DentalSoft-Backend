import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, Put, Req } from '@nestjs/common';
import { TreatmentService } from './treatment.service';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { UpdateTreatmentDto } from './dto/update-treatment.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { UpdateCostDto } from './dto/update-cost.dto';

@Controller('treatment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TreatmentController {
  constructor(private readonly treatmentService: TreatmentService) { }

  @Post(':clinicalHistoryId')
  @Roles('ADMIN', 'DOCTOR')
  create(
    @Param('clinicalHistoryId', ParseIntPipe) clinicalHistoryId: number,
    @Body() createTreatmentDto: CreateTreatmentDto,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
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
    @CurrentUser() user: { id: number, role: string; clinicId: number },
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

  @Get()
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  async findAllByClinic(
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.treatmentService.findAllByClinic(user.clinicId);
  }

  @Post(':treatmentId/payment')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  async registerPayment(
    @Param('treatmentId', ParseIntPipe) treatmentId: number,
    @Body() paymentDto: RegisterPaymentDto,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
    @Req() req: any,
  ) {
    return this.treatmentService.registerPayment(
      treatmentId,
      paymentDto,
      user.id,
      user.clinicId,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch(':treatmentId/cost')
  @Roles('ADMIN', 'DOCTOR')
  async updateCost(
    @Param('treatmentId', ParseIntPipe) treatmentId: number,
    @Body() costDto: UpdateCostDto,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.treatmentService.updateCost(treatmentId, costDto, user.id, user.clinicId);
  }

  @Get(':treatmentId/payment-status')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  async getPaymentStatus(
    @Param('treatmentId', ParseIntPipe) treatmentId: number,
  ) {
    return this.treatmentService.getPaymentStatus(treatmentId);
  }
}
