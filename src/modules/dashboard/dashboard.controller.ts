// src/modules/dashboard/dashboard.controller.ts
import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

// Guards (ajusta la ruta según tu proyecto)
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

// Servicio y DTOs
import { DashboardService } from './dashboard.service';
import {
  AppointmentsQueryDto,
  RevenueQueryDto,
  WeeklyActivityQueryDto,
  TreatmentActivityQueryDto
} from './dto/dashboard.dto';

@ApiTags('Dashboard')
@Controller('dashboard') // ✅ Sin /api
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @Get('stats')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener estadísticas principales del dashboard' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Estadísticas obtenidas exitosamente' })
  async getStats(@Req() req: any) {
    const clinicId = req.user.clinicId;
    const data = await this.dashboardService.getStats(clinicId);
    return {
      success: true,
      data,
      message: 'Dashboard stats retrieved successfully',
      timestamp: new Date().toISOString()
    };
  }

  @Get('appointments/today')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener citas del día' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Citas del día obtenidas exitosamente' })
  async getTodayAppointments(
    @Req() req: any,
    @Query() query: AppointmentsQueryDto,
  ) {
    const clinicId = req.user.clinicId;
    const data = await this.dashboardService.getTodayAppointments(
      clinicId,
      query.doctorId,
    );
    return {
      success: true,
      data,
      message: 'Today\'s appointments retrieved successfully',
      timestamp: new Date().toISOString()
    };
  }

  @Get('appointments/week/list')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener citas de la semana con detalles' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Citas de la semana obtenidas exitosamente' })
  async getWeekAppointments(
    @Req() req: any,
    @Query('date') date?: string,
    @Query('doctorId') doctorId?: number,
  ) {
    const clinicId = req.user.clinicId;
    const data = await this.dashboardService.getWeekAppointments(
      clinicId,
      date,
      doctorId,
    );
    return {
      success: true,
      data,
      message: 'Week appointments retrieved successfully',
      timestamp: new Date().toISOString()
    };
  }

  @Get('appointments/week')
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Obtener actividad semanal' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Actividad semanal obtenida exitosamente' })
  async getWeeklyActivity(
    @Req() req: any,
    @Query() query: WeeklyActivityQueryDto,
  ) {
    const clinicId = req.user.clinicId;
    const data = await this.dashboardService.getWeeklyActivity(clinicId, query);
    return {
      success: true,
      data,
      message: 'Weekly activity retrieved successfully',
      timestamp: new Date().toISOString()
    };
  }

  @Get('appointments/month')
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Obtener datos mensuales' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Datos mensuales obtenidos exitosamente' })
  async getMonthlyData(
    @Req() req: any,
    @Query('year') year?: number,
    @Query('month') month?: number,
  ) {
    const clinicId = req.user.clinicId;
    const data = await this.dashboardService.getMonthlyData(
      clinicId,
      year,
      month,
    );
    return {
      success: true,
      data,
      message: 'Monthly data retrieved successfully',
      timestamp: new Date().toISOString()
    };
  }

  @Get('revenue')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Obtener ingresos' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Ingresos obtenidos exitosamente' })
  async getRevenue(
    @Req() req: any,
    @Query() query: RevenueQueryDto,
  ) {
    const clinicId = req.user.clinicId;
    const data = await this.dashboardService.getRevenue(clinicId, query);
    return {
      success: true,
      data,
      message: 'Revenue data retrieved successfully',
      timestamp: new Date().toISOString()
    };
  }

  @Get('treatments/status')
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Obtener distribución de tratamientos por estado' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Distribución obtenida exitosamente' })
  async getTreatmentDistribution(@Req() req: any) {
    const clinicId = req.user.clinicId;
    const data = await this.dashboardService.getTreatmentDistribution(clinicId);
    return {
      success: true,
      data,
      message: 'Treatment distribution retrieved successfully',
      timestamp: new Date().toISOString()
    };
  }

  @Get('patients/new')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener nuevos pacientes' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Nuevos pacientes obtenidos exitosamente' })
  async getNewPatients(
    @Req() req: any,
    @Query('period') period: 'week' | 'month' = 'month',
  ) {
    const clinicId = req.user.clinicId;
    const data = await this.dashboardService.getNewPatients(clinicId, period);
    return {
      success: true,
      data,
      message: 'New patients retrieved successfully',
      timestamp: new Date().toISOString()
    };
  }

  @Get('treatments/week/by-status')
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({
    summary: 'Obtener actividad semanal de tratamientos con desglose por estado',
    description: 'Retorna el conteo de tratamientos por día y por estado'
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Actividad semanal de tratamientos por estado obtenida exitosamente' })
  async getWeeklyTreatmentByStatus(
    @Req() req: any,
    @Query() query: TreatmentActivityQueryDto,
  ) {
    const clinicId = req.user.clinicId;
    const data = await this.dashboardService.getWeeklyTreatmentByStatus(
      clinicId,
      query,
    );
    return {
      success: true,
      data,
      message: 'Weekly treatment by status retrieved successfully',
      timestamp: new Date().toISOString()
    };
  }

  @Get('appointments/next')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener las próximas citas programadas (sin límite de semana)' })
  async getNextAppointments(
    @Req() req: any,
    @Query('doctorId') doctorId?: number,
    @Query('limit') limit?: string,
  ) {
    const clinicId = req.user.clinicId;
    const data = await this.dashboardService.getNextAppointments(
      clinicId,
      doctorId,
      limit ? parseInt(limit, 10) : 2,
    );
    return {
      success: true,
      data,
      message: 'Next appointments retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('alerts')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener alertas del dashboard (sin límite de semana)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Alertas obtenidas exitosamente' })
  async getAlerts(@Req() req: any) {
    const clinicId = req.user.clinicId;
    const data = await this.dashboardService.getAlerts(clinicId);
    return {
      success: true,
      data,
      message: 'Dashboard alerts retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }
}