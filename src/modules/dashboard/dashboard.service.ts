import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { addDays, subDays } from 'date-fns';

import {
  DashboardStats,
  TodayAppointment,
  MonthlyData,
  RevenueData,
  RevenuePeriod,
  TreatmentDistribution,
  NewPatientsData,
  WeeklyActivityQueryDto,
  RevenueQueryDto,
  TreatmentActivityQueryDto,
  WeeklyTreatmentByStatus,
} from './dto/dashboard.dto';

import {
  DashboardAlertsResponseDto,
  DashboardAlertDto,
} from './dto/dashboard-alerts.dto';

import {
  toClinicDateParts,
  getClinicDayRange,
  getClinicWeekRange,
  getClinicMonthRange,
  getClinicNowParts,
} from '../../common/utils/datetime';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private prisma: PrismaService) { }

  // ============================================================
  // 1. ESTADÍSTICAS PRINCIPALES
  // ============================================================
  async getStats(clinicId: number): Promise<DashboardStats> {
    const { year, month } = getClinicNowParts();
    const { startUtc: startMonth, endUtc: endMonth } = getClinicMonthRange(year, month);

    const [totalPatients, pendingAppointments, activeTreatments, monthlyPayments] =
      await Promise.all([
        this.prisma.patient.count({
          where: { clinicId, isActive: true },
        }),
        this.prisma.appointment.count({
          where: { clinicId, status: 'SCHEDULED' },
        }),
        this.prisma.treatment.count({
          where: { clinicId, status: 'IN_PROGRESS' },
        }),
        this.prisma.payment.aggregate({
          where: {
            clinicId,
            status: 'ACTIVE',
            paymentDate: { gte: startMonth, lte: endMonth },
          },
          _sum: { amount: true },
        }),
      ]);

    return {
      totalPatients,
      pendingAppointments,
      activeTreatments,
      monthlyIncome: monthlyPayments._sum.amount
        ? Number(monthlyPayments._sum.amount)
        : 0,
    };
  }

  // ============================================================
  // 2. CITAS DEL DÍA
  // ============================================================
  async getTodayAppointments(
    clinicId: number,
    doctorId?: number,
  ): Promise<TodayAppointment[]> {
    const { startUtc, endUtc } = getClinicDayRange(new Date());

    const where: any = {
      clinicId,
      appointmentDate: { gte: startUtc, lte: endUtc },
    };
    if (doctorId) where.doctorId = doctorId;

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { fullName: true, photoUrl: true, phoneNumber: true } },
        treatment: { select: { name: true } },
      },
      orderBy: { appointmentDate: 'asc' },
    });

    return appointments.map((apt) => this.toTodayAppointment(apt));
  }

  // ============================================================
  // 2.1 CITAS DE LA SEMANA
  // ============================================================
  async getWeekAppointments(
    clinicId: number,
    date?: string,
    doctorId?: number,
  ): Promise<{
    weekStart: string;
    weekEnd: string;
    total: number;
    appointments: TodayAppointment[];
  }> {
    const referenceDate = date ? new Date(date) : new Date();
    const { startUtc, endUtc, weekStart, weekEnd } = getClinicWeekRange(referenceDate);

    const where: any = {
      clinicId,
      appointmentDate: { gte: startUtc, lte: endUtc },
    };
    if (doctorId) where.doctorId = doctorId;

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { fullName: true, photoUrl: true, phoneNumber: true } },
        doctor: { select: { name: true } },
        treatment: { select: { name: true } },
      },
      orderBy: { appointmentDate: 'asc' },
    });

    return {
      weekStart,
      weekEnd,
      total: appointments.length,
      appointments: appointments.map((apt) => this.toTodayAppointment(apt)),
    };
  }

  // ============================================================
  // 2.2 ACTIVIDAD SEMANAL POR ESTADO
  // ============================================================
  async getWeeklyActivity(
    clinicId: number,
    query: WeeklyActivityQueryDto,
  ): Promise<{
    weekStart: string;
    weekEnd: string;
    total: number;
    statusBreakdown: { status: string; count: number; percentage: number }[];
    days: {
      date: string;
      dayOfWeek: number;
      statuses: { [status: string]: number };
      total: number;
    }[];
  }> {
    const { startUtc, endUtc, weekStart, weekEnd } =
      this.resolveWeekRange(query);

    const where: any = {
      clinicId,
      appointmentDate: { gte: startUtc, lte: endUtc },
    };
    if (query.doctorId) where.doctorId = query.doctorId;

    const appointments = await this.prisma.appointment.findMany({
      where,
      select: { appointmentDate: true, status: true },
    });

    return this.aggregateByDayAndStatus(appointments, weekStart, weekEnd, startUtc);
  }

  // ============================================================
  // 3. DATOS MENSUALES
  // ============================================================
  async getMonthlyData(
    clinicId: number,
    year?: number,
    month?: number,
  ): Promise<MonthlyData> {
    const now = getClinicNowParts();
    const targetYear = year || now.year;
    const targetMonth = month || now.month;

    const { startUtc, endUtc } = getClinicMonthRange(targetYear, targetMonth);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        appointmentDate: { gte: startUtc, lte: endUtc },
        status: 'COMPLETED',
      },
      select: { appointmentDate: true },
    });

    const daySet = new Set<number>();
    for (const apt of appointments) {
      const { date } = toClinicDateParts(apt.appointmentDate);
      const day = Number(date.split('-')[2]);
      if (Number.isFinite(day)) daySet.add(day);
    }

    return {
      year: targetYear,
      month: targetMonth,
      daysWithAppointments: Array.from(daySet).sort((a, b) => a - b),
      totalAppointments: appointments.length,
    };
  }

  // ============================================================
  // 4. INGRESOS
  // ============================================================
  async getRevenue(clinicId: number, query: RevenueQueryDto): Promise<RevenueData> {
    const { startUtc, endUtc } = this.resolveRevenueRange(query);

    const treatments = await this.prisma.treatment.findMany({
      where: {
        clinicId,
        createdAt: { gte: startUtc, lte: endUtc },
        status: 'COMPLETED',
      },
      select: { totalCost: true, createdAt: true },
    });

    const dayMap = new Map<string, { amount: number; count: number }>();
    for (const treatment of treatments) {
      const { date: dateStr } = toClinicDateParts(treatment.createdAt);
      const bucket = dayMap.get(dateStr) ?? { amount: 0, count: 0 };
      bucket.amount += treatment.totalCost ? Number(treatment.totalCost) : 0;
      bucket.count += 1;
      dayMap.set(dateStr, bucket);
    }

    const breakdown = Array.from(dayMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      period: query.period,
      startDate: toClinicDateParts(startUtc).date,
      endDate: toClinicDateParts(endUtc).date,
      total: breakdown.reduce((sum, item) => sum + item.amount, 0),
      breakdown,
    };
  }

  // ============================================================
  // 5. DISTRIBUCIÓN DE TRATAMIENTOS
  // ============================================================
  async getTreatmentDistribution(clinicId: number): Promise<TreatmentDistribution[]> {
    const result = await this.prisma.treatment.groupBy({
      by: ['status'],
      where: { clinicId },
      _count: { status: true },
    });

    const total = result.reduce((sum, item) => sum + item._count.status, 0);

    return result.map((item) => ({
      status: item.status,
      count: item._count.status,
      percentage: total > 0 ? (item._count.status / total) * 100 : 0,
    }));
  }

  // ============================================================
  // 6. NUEVOS PACIENTES
  // ============================================================
  async getNewPatients(
    clinicId: number,
    period: 'week' | 'month' = 'month',
  ): Promise<NewPatientsData> {
    const now = new Date();
    const startDate = subDays(now, period === 'week' ? 7 : 30);

    const patients = await this.prisma.patient.findMany({
      where: {
        clinicId,
        createdAt: { gte: startDate, lte: now },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      period,
      total: patients.length,
      patients: patients.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        email: p.email || '',
        phoneNumber: p.phoneNumber,
        createdAt: toClinicDateParts(p.createdAt).date,
      })),
    };
  }

  // ============================================================
  // 7. TRATAMIENTOS SEMANALES POR ESTADO
  // ============================================================
  async getWeeklyTreatmentByStatus(
    clinicId: number,
    query: TreatmentActivityQueryDto,
  ): Promise<WeeklyTreatmentByStatus> {
    const { startUtc, endUtc, weekStart, weekEnd } =
      this.resolveWeekRange(query);

    const where: any = {
      clinicId,
      createdAt: { gte: startUtc, lte: endUtc },
    };
    if (query.doctorId) where.doctorId = query.doctorId;

    const treatments = await this.prisma.treatment.findMany({
      where,
      select: { createdAt: true, status: true },
    });

    return this.aggregateByDayAndStatus(treatments, weekStart, weekEnd, startUtc);
  }

  // ============================================================
  // 8. PRÓXIMAS CITAS
  // ============================================================
  async getNextAppointments(
    clinicId: number,
    doctorId?: number,
    limit: number = 2,
  ): Promise<TodayAppointment[]> {
    const where: any = {
      clinicId,
      appointmentDate: { gte: new Date() },
      status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] },
    };
    if (doctorId) where.doctorId = doctorId;

    const appointments = await this.prisma.appointment.findMany({
      where,
      orderBy: { appointmentDate: 'asc' },
      take: limit,
      include: {
        patient: { select: { fullName: true, photoUrl: true, phoneNumber: true } },
        doctor: { select: { name: true } },
        treatment: { select: { name: true } },
      },
    });

    return appointments.map((apt) => this.toTodayAppointment(apt));
  }

  // ============================================================
  // 9. ALERTAS DEL DASHBOARD
  // ============================================================
  async getAlerts(clinicId: number): Promise<DashboardAlertsResponseDto> {
    const now = new Date();
    const endOfTomorrow = getClinicDayRange(addDays(now, 1)).endUtc;
    const sevenDaysAgo = subDays(now, 7);
    const fifteenDaysAgo = subDays(now, 15);

    const [
      unconfirmedAppointments,
      noShowAppointments,
      inProgressAppointments,
      cancelledCount,
      pendingTreatments,
      pendingPayments,
    ] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          clinicId,
          appointmentDate: { gte: now, lte: endOfTomorrow },
          status: 'SCHEDULED',
        },
        include: { patient: { select: { fullName: true } } },
        orderBy: { appointmentDate: 'asc' },
        take: 50,
      }),

      this.prisma.appointment.findMany({
        where: {
          clinicId,
          appointmentDate: { gte: sevenDaysAgo, lte: now },
          status: 'NO_SHOW',
        },
        include: { patient: { select: { fullName: true } } },
        orderBy: { appointmentDate: 'desc' },
        take: 50,
      }),

      this.prisma.appointment.findMany({
        where: { clinicId, status: 'IN_PROGRESS' },
        include: { patient: { select: { fullName: true } } },
        take: 20,
      }),

      this.prisma.appointment.count({
        where: {
          clinicId,
          appointmentDate: { gte: sevenDaysAgo },
          status: 'CANCELLED',
        },
      }),

      this.prisma.treatment.findMany({
        where: {
          clinicId,
          status: 'IN_PROGRESS',
          createdAt: { lte: fifteenDaysAgo },
          sessions: { none: { sessionDate: { gte: fifteenDaysAgo } } },
        },
        include: {
          clinicalHistory: { include: { patient: { select: { fullName: true } } } },
        },
        take: 50,
      }),

      this.prisma.treatment.findMany({
        where: {
          clinicId,
          paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
          remainingBalance: { gt: 0 },
        },
        select: {
          id: true,
          name: true,
          remainingBalance: true,
          clinicalHistory: { select: { patient: { select: { fullName: true } } } },
        },
        orderBy: { remainingBalance: 'desc' },
        take: 100,
      }),
    ]);

    const alerts: DashboardAlertDto[] = [];
    const sampleNames = (items: any[]) =>
      items
        .slice(0, 3)
        .map((a) => a.patient?.fullName ?? a.clinicalHistory?.patient?.fullName)
        .filter((n): n is string => !!n);

    if (unconfirmedAppointments.length > 0) {
      const count = unconfirmedAppointments.length;
      alerts.push({
        type: 'UNCONFIRMED_APPOINTMENTS',
        severity: 'warning',
        count,
        label: `${count} ${count === 1 ? 'cita sin confirmar' : 'citas sin confirmar'}`,
        description: 'Para hoy o mañana',
        href: '/appointments?status=SCHEDULED&range=today-tomorrow',
        metadata: { sampleNames: sampleNames(unconfirmedAppointments) },
      });
    }

    if (noShowAppointments.length > 0) {
      const count = noShowAppointments.length;
      alerts.push({
        type: 'NO_SHOW',
        severity: 'critical',
        count,
        label: `${count} ${count === 1 ? 'paciente no asistió' : 'pacientes no asistieron'}`,
        description: 'Últimos 7 días',
        href: '/appointments?status=NO_SHOW&range=last-7-days',
        metadata: { sampleNames: sampleNames(noShowAppointments) },
      });
    }

    if (inProgressAppointments.length > 0) {
      const count = inProgressAppointments.length;
      alerts.push({
        type: 'IN_PROGRESS',
        severity: 'success',
        count,
        label: `${count} ${count === 1 ? 'paciente en consulta' : 'pacientes en consulta'}`,
        description: 'Ahora mismo',
        href: '/appointments?status=IN_PROGRESS',
        metadata: { sampleNames: sampleNames(inProgressAppointments) },
      });
    }

    if (cancelledCount > 0) {
      alerts.push({
        type: 'CANCELLED',
        severity: 'info',
        count: cancelledCount,
        label: `${cancelledCount} ${cancelledCount === 1 ? 'cita cancelada' : 'citas canceladas'}`,
        description: 'Últimos 7 días',
        href: '/appointments?status=CANCELLED&range=last-7-days',
      });
    }

    if (pendingTreatments.length > 0) {
      const count = pendingTreatments.length;
      alerts.push({
        type: 'PENDING_TREATMENTS',
        severity: 'warning',
        count,
        label: `${count} ${count === 1 ? 'tratamiento sin sesión' : 'tratamientos sin sesión'}`,
        description: 'Hace más de 15 días',
        href: '/treatments?status=IN_PROGRESS&stale=15',
        metadata: { sampleNames: sampleNames(pendingTreatments) },
      });
    }

    if (pendingPayments.length > 0) {
      const count = pendingPayments.length;
      const totalAmount = pendingPayments.reduce(
        (sum, t) => sum + Number(t.remainingBalance ?? 0),
        0,
      );
      alerts.push({
        type: 'PENDING_PAYMENTS',
        severity: 'info',
        count,
        label: `${count} ${count === 1 ? 'saldo pendiente' : 'saldos pendientes'}`,
        description: `Total por cobrar: Bs ${totalAmount.toFixed(2)}`,
        href: '/treatments?paymentStatus=UNPAID,PARTIAL',
        metadata: {
          totalAmount,
          sampleNames: sampleNames(pendingPayments),
        },
      });
    }

    return {
      alerts,
      totalCount: alerts.length,
      generatedAt: now.toISOString(),
    };
  }

  // ============================================================
  // HELPERS PRIVADOS
  // ============================================================

  /**
   * Mapea una entidad Appointment (Prisma) al DTO `TodayAppointment`,
   * usando la zona horaria de la clínica para fecha/hora.
   */
  private toTodayAppointment(apt: any): TodayAppointment {
    const { date, time } = toClinicDateParts(apt.appointmentDate);
    return {
      id: apt.id,
      patientName: apt.patient?.fullName || 'Paciente',
      patientPhoto: apt.patient?.photoUrl || null,
      patientPhone: apt.patient?.phoneNumber || null,
      treatment: apt.treatment?.name || 'Consulta general',
      time,
      date,
      appointmentDate: apt.appointmentDate.toISOString(),
      status: apt.status,
      duration: apt.duration || 30,
      doctorName: apt.doctor?.name || 'Doctor',
    };
  }

  /**
   * Resuelve el rango UTC de una semana clínica,
   * respetando weekStart/weekEnd o usando date/now como referencia.
   */
  private resolveWeekRange(query: {
    date?: string;
    weekStart?: string;
    weekEnd?: string;
  }): { startUtc: Date; endUtc: Date; weekStart: string; weekEnd: string } {
    if (query.weekStart && query.weekEnd) {
      const ws = getClinicWeekRange(query.weekStart);
      const we = getClinicWeekRange(query.weekEnd);
      return {
        startUtc: ws.startUtc,
        endUtc: we.endUtc,
        weekStart: ws.weekStart,
        weekEnd: we.weekEnd,
      };
    }
    const ref = query.date ? new Date(query.date) : new Date();
    return getClinicWeekRange(ref);
  }

  /**
   * Resuelve el rango UTC para ingresos según period o startDate/endDate.
   */
  private resolveRevenueRange(query: RevenueQueryDto): {
    startUtc: Date;
    endUtc: Date;
  } {
    if (query.startDate && query.endDate) {
      return {
        startUtc: getClinicDayRange(query.startDate).startUtc,
        endUtc: getClinicDayRange(query.endDate).endUtc,
      };
    }

    const now = getClinicNowParts();
    switch (query.period) {
      case RevenuePeriod.DAILY: {
        const r = getClinicDayRange(new Date());
        return { startUtc: r.startUtc, endUtc: r.endUtc };
      }
      case RevenuePeriod.WEEKLY: {
        const r = getClinicWeekRange(new Date());
        return { startUtc: r.startUtc, endUtc: r.endUtc };
      }
      case RevenuePeriod.MONTHLY:
      default: {
        const r = getClinicMonthRange(now.year, now.month);
        return { startUtc: r.startUtc, endUtc: r.endUtc };
      }
    }
  }

  /**
   * Agrupa items (con createdAt o appointmentDate + status) por día clínico
   * y estado, devolviendo la estructura de "weekly activity".
   */
  private aggregateByDayAndStatus(
    items: Array<{ status: string; createdAt?: Date; appointmentDate?: Date }>,
    weekStart: string,
    weekEnd: string,
    startUtc: Date,
  ) {
    const dayMap = new Map<string, { dayOfWeek: number; statuses: Map<string, number> }>();
    const globalStatusMap = new Map<string, number>();

    let current = new Date(startUtc);
    for (let i = 0; i < 7; i++) {
      const { date: dateStr } = toClinicDateParts(current);
      dayMap.set(dateStr, {
        dayOfWeek: current.getUTCDay(),
        statuses: new Map<string, number>(),
      });
      current = addDays(current, 1);
    }

    for (const item of items) {
      const sourceDate = item.createdAt ?? item.appointmentDate;
      if (!sourceDate) continue;

      const { date: dateStr } = toClinicDateParts(sourceDate);
      const status = item.status;

      const dayData = dayMap.get(dateStr);
      if (dayData) {
        dayData.statuses.set(status, (dayData.statuses.get(status) || 0) + 1);
      }
      globalStatusMap.set(status, (globalStatusMap.get(status) || 0) + 1);
    }

    const days = Array.from(dayMap.entries()).map(([date, data]) => {
      const statuses: { [key: string]: number } = {};
      let total = 0;
      data.statuses.forEach((count, status) => {
        statuses[status] = count;
        total += count;
      });
      return { date, dayOfWeek: data.dayOfWeek, statuses, total };
    });

    const total = items.length;
    const statusBreakdown = Array.from(globalStatusMap.entries())
      .map(([status, count]) => ({
        status,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      weekStart,
      weekEnd,
      total,
      statusBreakdown,
      days,
    };
  }
}