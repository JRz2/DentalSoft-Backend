// src/modules/reports/reports.controller.ts
import {
  Controller,
  Get,
  Query,
  Param,
  Res,
  UseGuards,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'; // ⚠️ ajusta la ruta

const logger = new Logger('ReportsController');

@Controller('reports')
@UseGuards(JwtAuthGuard) // ✅ Ahora sí se ejecuta la autenticación
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }

  @Get('daily-closure')
  async getDailyClosure(
    @Query('date') date: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    logger.log(`[daily-closure] user=${JSON.stringify(user)} date=${date}`);
    if (!user) throw new Error('user undefined: el guard no está activo');
    const pdfBuffer = await this.reportsService.generateDailyClosure(
      date,
      user.clinicId,
    );
    this.sendPdf(res, pdfBuffer, `cierre-diario-${date}.pdf`);
  }

  @Get('monthly-income')
  async getMonthlyIncome(
    @Query('month') month: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    logger.log(`[monthly-income] user=${JSON.stringify(user)} month=${month}`);
    if (!user) throw new Error('user undefined: el guard no está activo');
    const pdfBuffer = await this.reportsService.generateMonthlyIncome(
      month,
      user.clinicId,
    );
    this.sendPdf(res, pdfBuffer, `ingresos-mes-${month}.pdf`);
  }

  @Get('patient-history/:patientId')
  async getPatientHistory(
    @Param('patientId') patientId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    logger.log(`[patient-history] user=${JSON.stringify(user)} patientId=${patientId}`);
    if (!user) throw new Error('user undefined: el guard no está activo');
    const pdfBuffer = await this.reportsService.generatePatientHistory(
      parseInt(patientId, 10),
      user.clinicId,
    );
    this.sendPdf(res, pdfBuffer, `historial-paciente-${patientId}.pdf`);
  }

  private sendPdf(res: Response, buffer: Buffer, filename: string) {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('debts')
  async getDebts(@CurrentUser() user: any, @Res() res: Response) {
    const pdfBuffer = await this.reportsService.generateDebtsReport(user.clinicId);
    this.sendPdf(res, pdfBuffer, `cuentas-por-cobrar.pdf`);
  }

  @Get('voided-payments')
  async getVoidedPayments(@CurrentUser() user: any, @Res() res: Response) {
    const pdfBuffer = await this.reportsService.generateVoidedPaymentsReport(user.clinicId);
    this.sendPdf(res, pdfBuffer, `pagos-anulados.pdf`);
  }
}