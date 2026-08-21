import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, Put, Req, BadRequestException } from '@nestjs/common';
import { TreatmentService } from './treatment.service';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { UpdateTreatmentDto } from './dto/update-treatment.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { UpdateCostDto } from './dto/update-cost.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Treatment')
@ApiBearerAuth()
@Controller('treatment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TreatmentController {
  constructor(private readonly treatmentService: TreatmentService) { }

  @Post(':clinicalHistoryId')
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Crear un nuevo tratamiento' })
  create(
    @Param('clinicalHistoryId', ParseIntPipe) clinicalHistoryId: number,
    @Body() createTreatmentDto: CreateTreatmentDto,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
    @Req() req: any,
  ) {
    return this.treatmentService.create(
      createTreatmentDto, 
      clinicalHistoryId, 
      user.id, 
      user.clinicId,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get('patient/:patientId')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener todos los tratamientos de un paciente' })
  findAllByPatient(
    @Param('patientId', ParseIntPipe) patientId: number,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.treatmentService.findByPatientId(patientId, user.clinicId);
  }

  @Get(':id')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener un tratamiento por ID' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.treatmentService.findOne(id, user.clinicId);
  }

  @Put(':id')
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Actualizar un tratamiento' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTreatmentDto: UpdateTreatmentDto,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.treatmentService.update(
      id, 
      updateTreatmentDto, 
      user.clinicId,
      user.id,
    );
  }

  @Patch(':id/complete')
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Completar un tratamiento' })
  async complete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.treatmentService.complete(
      id, 
      user.id, 
      user.role as any, 
      user.clinicId
    );
  }

  @Patch(':id/cancel')
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Cancelar un tratamiento' })
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.treatmentService.cancel(
      id, 
      user.id, 
      user.role as any, 
      user.clinicId
    );
  }

  @Get()
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener todos los tratamientos de la clínica' })
  async findAllByClinic(
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.treatmentService.findAll(user.clinicId);
  }

  @Post(':treatmentId/payment')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Registrar un pago para un tratamiento' })
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
  @ApiOperation({ summary: 'Actualizar costo de un tratamiento' })
  async updateCost(
    @Param('treatmentId', ParseIntPipe) treatmentId: number,
    @Body() costDto: UpdateCostDto,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.treatmentService.updateCost(
      treatmentId, 
      costDto, 
      user.id, 
      user.clinicId
    );
  }

  @Get(':treatmentId/payment-status')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener estado de pagos de un tratamiento' })
  async getPaymentStatus(
    @Param('treatmentId', ParseIntPipe) treatmentId: number,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.treatmentService.getPaymentStatus(treatmentId, user.clinicId);
  }
}