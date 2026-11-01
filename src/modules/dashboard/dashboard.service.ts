import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  addDays,
  subDays,
  format,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth
} from 'date-fns';

// DTOs e Interfaces
import {
  DashboardStats,
  WeeklyActivity,
  TodayAppointment,
  MonthlyData,
  RevenueData,
  RevenuePeriod,
  TreatmentDistribution,
  NewPatientsData,
  WeeklyActivityQueryDto,
  RevenueQueryDto,
  TreatmentActivityQueryDto,
  WeeklyTreatmentByStatus
} from './dto/dashboard.dto';

import {
  DashboardAlertsResponseDto,
  DashboardAlertDto,
} from './dto/dashboard-alerts.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private prisma: PrismaService) { }

  // ============================================================
  // 1. ESTADÍSTICAS PRINCIPALES
  // ============================================================
  async getStats(clinicId: number): Promise<DashboardStats> {
    this.logger.log(`Getting dashboard stats for clinic ${clinicId}`);

    const now = new Date();
    const startMonth = startOfMonth(now);
    const endMonth = endOfMonth(now);

    const [totalPatients, pendingAppointments, activeTreatments, monthlyPayments] =
      await Promise.all([
        // 1. Total pacientes activos
        this.prisma.patient.count({
          where: {
            clinicId,
            isActive: true,
          },
        }),

        // 2. Citas pendientes — TODAS las agendadas, sin restricción de fecha
        this.prisma.appointment.count({
          where: {
            clinicId,
            status: 'SCHEDULED',
          },
        }),

        // 3. Tratamientos activos — todos los IN_PROGRESS
        this.prisma.treatment.count({
          where: {
            clinicId,
            status: 'IN_PROGRESS',
          },
        }),

        // 4. Ingresos del mes — suma de PAGOS activos del mes
        this.prisma.payment.aggregate({
          where: {
            clinicId,
            status: 'ACTIVE',
            paymentDate: {
              gte: startMonth,
              lte: endMonth,
            },
          },
          _sum: {
            amount: true,
          },
        }),
      ]);

    const monthlyIncome = monthlyPayments._sum.amount
      ? Number(monthlyPayments._sum.amount)
      : 0;

    this.logger.log(`📊 Stats: patients=${totalPatients}, pendingAppts=${pendingAppointments}, activeTreatments=${activeTreatments}, monthlyIncome=${monthlyIncome}`);

    return {
      totalPatients,
      pendingAppointments,
      activeTreatments,
      monthlyIncome,
    };
  }

  // ============================================================
  // 2. CITAS DEL DÍA
  // ============================================================
  async getTodayAppointments(clinicId: number, doctorId?: number): Promise<TodayAppointment[]> {
    this.logger.log(`Getting today's appointments for clinic ${clinicId}`);

    const now = new Date();
    const start = startOfDay(now);
    const end = endOfDay(now);

    this.logger.log(`📅 Buscando citas del día: ${format(start, 'yyyy-MM-dd')}`);

    const where: any = {
      clinicId,
      appointmentDate: {
        gte: start,
        lte: end
      }
    };

    if (doctorId) {
      where.doctorId = doctorId;
    }

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: {
            fullName: true,
            photoUrl: true
          }
        },
        treatment: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        appointmentDate: 'asc'
      }
    });

    this.logger.log(`📊 Citas encontradas: ${appointments.length}`);

    return appointments.map(apt => ({
      id: apt.id,
      patientName: apt.patient?.fullName || 'Paciente',
      patientPhoto: apt.patient?.photoUrl || null,
      treatment: apt.treatment?.name || 'Consulta general',
      time: format(apt.appointmentDate, 'HH:mm'),
      status: apt.status,
      duration: apt.duration || 30
    }));
  }

  // ============================================================
  // 2.1 CITAS DE LA SEMANA (LISTA)
  // ============================================================
  async getWeekAppointments(
    clinicId: number,
    date?: string,
    doctorId?: number
  ): Promise<{
    weekStart: string;
    weekEnd: string;
    total: number;
    appointments: TodayAppointment[];
  }> {
    this.logger.log(`Getting week appointments for clinic ${clinicId}`);

    // Fecha de referencia
    const referenceDate = date ? new Date(date) : new Date();

    // Calcular semana
    let start = startOfWeek(referenceDate, { weekStartsOn: 1 });
    let end = endOfWeek(referenceDate, { weekStartsOn: 1 });

    // Ajustar horas
    start = startOfDay(start);
    end = endOfDay(end);

    this.logger.log(`📅 Semana: ${format(start, 'yyyy-MM-dd')} - ${format(end, 'yyyy-MM-dd')}`);

    const where: any = {
      clinicId,
      appointmentDate: {
        gte: start,
        lte: end
      }
    };

    if (doctorId) {
      where.doctorId = doctorId;
    }

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: {
            fullName: true,
            photoUrl: true
          }
        },
        doctor: {
          select: {
            name: true
          }
        },
        treatment: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        appointmentDate: 'asc'
      }
    });

    this.logger.log(`📊 Citas encontradas: ${appointments.length}`);

    const mappedAppointments = appointments.map(apt => ({
      id: apt.id,
      patientName: apt.patient?.fullName || 'Paciente',
      patientPhoto: apt.patient?.photoUrl || null,
      treatment: apt.treatment?.name || 'Consulta general',
      time: format(apt.appointmentDate, 'HH:mm'),
      status: apt.status,
      duration: apt.duration || 30,
      doctorName: apt.doctor?.name || 'Doctor',
      date: format(apt.appointmentDate, 'yyyy-MM-dd'),
    }));

    return {
      weekStart: format(start, 'yyyy-MM-dd'),
      weekEnd: format(end, 'yyyy-MM-dd'),
      total: appointments.length,
      appointments: mappedAppointments,
    };
  }

  // ============================================================
  // 2.2 ACTIVIDAD SEMANAL - CON FILTRO CONFIGURABLE
  // ============================================================
  async getWeeklyActivity(
    clinicId: number,
    query: WeeklyActivityQueryDto
  ): Promise<{
    weekStart: string;
    weekEnd: string;
    total: number;
    statusBreakdown: {
      status: string;
      count: number;
      percentage: number;
    }[];
    days: {
      date: string;
      dayOfWeek: number;
      statuses: {
        [status: string]: number;
      };
      total: number;
    }[];
  }> {
    this.logger.log(`========================================`);
    this.logger.log(`📊 GETTING WEEKLY ACTIVITY BY STATUS`);
    this.logger.log(`========================================`);
    this.logger.log(`🏥 Clinic ID: ${clinicId}`);
    this.logger.log(`📅 Fecha referencia: ${query.date || 'Hoy'}`);
    this.logger.log(`👨‍⚕️ Doctor ID: ${query.doctorId || 'Todos'}`);

    let start: Date;
    let end: Date;

    // Si se pasan fechas específicas, usarlas
    if (query.weekStart && query.weekEnd) {
      start = startOfDay(new Date(query.weekStart));
      end = endOfDay(new Date(query.weekEnd));
    } else {
      const referenceDate = query.date ? new Date(query.date) : new Date();
      start = startOfDay(startOfWeek(referenceDate, { weekStartsOn: 1 }));
      end = endOfDay(endOfWeek(referenceDate, { weekStartsOn: 1 }));
    }

    this.logger.log(`📅 Semana: ${format(start, 'yyyy-MM-dd')} - ${format(end, 'yyyy-MM-dd')}`);

    // ============================================================
    // 📊 OBTENER TODAS LAS CITAS DE LA SEMANA
    // ============================================================
    const where: any = {
      clinicId,
      appointmentDate: {
        gte: start,
        lte: end
      }
    };

    if (query.doctorId) {
      where.doctorId = query.doctorId;
    }

    const appointments = await this.prisma.appointment.findMany({
      where,
      select: {
        appointmentDate: true,
        status: true
      }
    });

    this.logger.log(`📊 Total citas encontradas: ${appointments.length}`);

    // ============================================================
    // 📊 INICIALIZAR MAPAS
    // ============================================================
    // Mapa de días con sus estados
    const dayMap = new Map<string, {
      dayOfWeek: number;
      statuses: Map<string, number>;
    }>();

    // Mapa global de estados
    const globalStatusMap = new Map<string, number>();

    // Inicializar los 7 días de la semana
    let currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      dayMap.set(dateStr, {
        dayOfWeek: currentDate.getDay(),
        statuses: new Map<string, number>()
      });
      currentDate = addDays(currentDate, 1);
    }

    // ============================================================
    // 📊 PROCESAR CITAS
    // ============================================================
    appointments.forEach(apt => {
      const dateStr = format(apt.appointmentDate, 'yyyy-MM-dd');
      const status = apt.status;

      // Agregar al día
      const dayData = dayMap.get(dateStr);
      if (dayData) {
        const statusCount = dayData.statuses.get(status) || 0;
        dayData.statuses.set(status, statusCount + 1);
      }

      // Agregar al global
      const globalCount = globalStatusMap.get(status) || 0;
      globalStatusMap.set(status, globalCount + 1);
    });

    // ============================================================
    // 📊 CONSTRUIR RESULTADO
    // ============================================================
    // Construir días
    const days = Array.from(dayMap.entries()).map(([date, data]) => {
      const statusesObj: { [key: string]: number } = {};
      let total = 0;

      data.statuses.forEach((count, status) => {
        statusesObj[status] = count;
        total += count;
      });

      return {
        date,
        dayOfWeek: data.dayOfWeek,
        statuses: statusesObj,
        total
      };
    });

    // Construir desglose de estados
    const totalAppointments = appointments.length;
    const statusBreakdown = Array.from(globalStatusMap.entries()).map(([status, count]) => ({
      status,
      count,
      percentage: totalAppointments > 0 ? (count / totalAppointments) * 100 : 0
    }));

    // Ordenar por cantidad descendente
    statusBreakdown.sort((a, b) => b.count - a.count);

    // ============================================================
    // 🔍 LOG DE RESULTADOS
    // ============================================================
    this.logger.log(`📊 Desglose por estado:`);
    statusBreakdown.forEach(item => {
      this.logger.log(`  - ${item.status}: ${item.count} citas (${item.percentage.toFixed(1)}%)`);
    });

    this.logger.log(`📊 Distribución por día:`);
    days.forEach(day => {
      if (day.total > 0) {
        const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][day.dayOfWeek];
        this.logger.log(`  - ${dayName} (${day.date}): ${day.total} citas`);
        Object.entries(day.statuses).forEach(([status, count]) => {
          this.logger.log(`      ${status}: ${count}`);
        });
      }
    });
    this.logger.log(`========================================`);

    return {
      weekStart: format(start, 'yyyy-MM-dd'),
      weekEnd: format(end, 'yyyy-MM-dd'),
      total: totalAppointments,
      statusBreakdown,
      days,
    };
  }

  // ============================================================
  // 3. DATOS MENSUALES
  // ============================================================
  async getMonthlyData(clinicId: number, year?: number, month?: number): Promise<MonthlyData> {
    this.logger.log(`Getting monthly data for clinic ${clinicId}`);

    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || now.getMonth() + 1;

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        appointmentDate: {
          gte: startDate,
          lte: endDate
        },
        status: 'COMPLETED'
      },
      select: {
        appointmentDate: true
      }
    });

    const daySet = new Set<number>();
    appointments.forEach(apt => {
      daySet.add(apt.appointmentDate.getDate());
    });

    return {
      year: targetYear,
      month: targetMonth,
      daysWithAppointments: Array.from(daySet),
      totalAppointments: appointments.length
    };
  }

  // ============================================================
  // 4. INGRESOS
  // ============================================================
  async getRevenue(clinicId: number, query: RevenueQueryDto): Promise<RevenueData> {
    this.logger.log(`Getting revenue data for clinic ${clinicId}`);

    let start: Date;
    let end: Date;

    if (query.startDate && query.endDate) {
      start = new Date(query.startDate);
      end = new Date(query.endDate);
    } else {
      const now = new Date();
      switch (query.period) {
        case RevenuePeriod.DAILY:
          start = startOfDay(now);
          end = endOfDay(now);
          break;
        case RevenuePeriod.WEEKLY:
          start = startOfDay(startOfWeek(now, { weekStartsOn: 1 }));
          end = endOfDay(endOfWeek(now, { weekStartsOn: 1 }));
          break;
        case RevenuePeriod.MONTHLY:
        default:
          start = startOfDay(startOfMonth(now));
          end = endOfDay(endOfMonth(now));
          break;
      }
    }

    this.logger.log(`📅 Ingresos: ${format(start, 'yyyy-MM-dd')} - ${format(end, 'yyyy-MM-dd')}`);

    const treatments = await this.prisma.treatment.findMany({
      where: {
        clinicId,
        createdAt: {
          gte: start,
          lte: end
        },
        status: 'COMPLETED'
      },
      select: {
        totalCost: true,
        createdAt: true
      }
    });

    // Agrupar por día
    const dayMap = new Map<string, { amount: number; count: number }>();
    treatments.forEach(treatment => {
      const dateStr = format(treatment.createdAt, 'yyyy-MM-dd');
      if (!dayMap.has(dateStr)) {
        dayMap.set(dateStr, { amount: 0, count: 0 });
      }
      const data = dayMap.get(dateStr);
      if (data) {
        const cost = treatment.totalCost ? Number(treatment.totalCost) : 0;
        data.amount += cost;
        data.count += 1;
      }
    });

    const breakdown = Array.from(dayMap.entries()).map(([date, data]) => ({
      date,
      amount: data.amount,
      count: data.count
    }));

    const total = breakdown.reduce((sum, item) => sum + item.amount, 0);

    return {
      period: query.period,
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
      total,
      breakdown
    };
  }

  // ============================================================
  // 5. DISTRIBUCIÓN DE TRATAMIENTOS
  // ============================================================
  async getTreatmentDistribution(clinicId: number): Promise<TreatmentDistribution[]> {
    this.logger.log(`Getting treatment distribution for clinic ${clinicId}`);

    const result = await this.prisma.treatment.groupBy({
      by: ['status'],
      where: {
        clinicId
      },
      _count: {
        status: true
      }
    });

    const total = result.reduce((sum, item) => sum + item._count.status, 0);

    return result.map(item => ({
      status: item.status,
      count: item._count.status,
      percentage: total > 0 ? (item._count.status / total) * 100 : 0
    }));
  }

  // ============================================================
  // 6. NUEVOS PACIENTES
  // ============================================================
  async getNewPatients(clinicId: number, period: 'week' | 'month' = 'month'): Promise<NewPatientsData> {
    this.logger.log(`Getting new patients for clinic ${clinicId}`);

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = subDays(now, 7);
        break;
      case 'month':
      default:
        startDate = subDays(now, 30);
        break;
    }

    const patients = await this.prisma.patient.findMany({
      where: {
        clinicId,
        createdAt: {
          gte: startDate,
          lte: now
        }
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      period,
      total: patients.length,
      patients: patients.map(p => ({
        id: p.id,
        fullName: p.fullName,
        email: p.email || '',
        phoneNumber: p.phoneNumber,
        createdAt: format(p.createdAt, 'yyyy-MM-dd')
      }))
    };
  }

  async getWeeklyTreatmentByStatus(
    clinicId: number,
    query: TreatmentActivityQueryDto
  ): Promise<WeeklyTreatmentByStatus> {
    this.logger.log(`========================================`);
    this.logger.log(`📊 GETTING WEEKLY TREATMENT BY STATUS`);
    this.logger.log(`========================================`);
    this.logger.log(`🏥 Clinic ID: ${clinicId}`);
    this.logger.log(`📅 Fecha referencia: ${query.date || 'Hoy'}`);
    this.logger.log(`📊 Status filtro: ${query.status || 'Todos'}`);
    this.logger.log(`👨‍⚕️ Doctor ID: ${query.doctorId || 'Todos'}`);

    let start: Date;
    let end: Date;

    if (query.weekStart && query.weekEnd) {
      start = startOfDay(new Date(query.weekStart));
      end = endOfDay(new Date(query.weekEnd));
    } else {
      const referenceDate = query.date ? new Date(query.date) : new Date();
      start = startOfDay(startOfWeek(referenceDate, { weekStartsOn: 1 }));
      end = endOfDay(endOfWeek(referenceDate, { weekStartsOn: 1 }));
    }

    this.logger.log(`📅 Semana: ${format(start, 'yyyy-MM-dd')} - ${format(end, 'yyyy-MM-dd')}`);
    this.logger.log(`📅 Semana (ISO): ${start.toISOString()} - ${end.toISOString()}`);

    // ============================================================
    // 🔍 CONTAR TOTAL DE TRATAMIENTOS EN LA CLÍNICA
    // ============================================================
    const totalInClinic = await this.prisma.treatment.count({
      where: { clinicId }
    });
    this.logger.log(`📊 Total tratamientos en la clínica: ${totalInClinic}`);

    // ============================================================
    // 🔍 VER TODOS LOS TRATAMIENTOS DE LA CLÍNICA
    // ✅ CORREGIDO: Usar clinicalHistory -> patient
    // ============================================================
    const allTreatments = await this.prisma.treatment.findMany({
      where: { clinicId },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        clinicalHistory: {
          select: {
            patient: {
              select: { fullName: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    this.logger.log(`📋 Últimos 10 tratamientos de la clínica:`);
    allTreatments.forEach(t => {
      // ✅ CORREGIDO: Acceder a clinicalHistory.patient.fullName
      const patientName = t.clinicalHistory?.patient?.fullName || 'Sin paciente';
      this.logger.log(`  - ID: ${t.id}, Nombre: ${t.name}, Estado: ${t.status}, Fecha: ${format(t.createdAt, 'yyyy-MM-dd HH:mm')}, Paciente: ${patientName}`);
    });

    // ============================================================
    // 📊 OBTENER TODOS LOS TRATAMIENTOS DE LA SEMANA
    // ============================================================
    const where: any = {
      clinicId,
      createdAt: {
        gte: start,
        lte: end
      }
    };

    if (query.doctorId) {
      where.doctorId = query.doctorId;
      this.logger.log(`🔍 Filtro por doctor: ${query.doctorId}`);
    }

    const treatments = await this.prisma.treatment.findMany({
      where,
      select: {
        createdAt: true,
        status: true
      }
    });

    this.logger.log(`📊 Total tratamientos encontrados en la semana: ${treatments.length}`);

    // ============================================================
    // 🔍 MOSTRAR CADA TRATAMIENTO
    // ============================================================
    if (treatments.length > 0) {
      this.logger.log(`📋 Detalle de tratamientos encontrados:`);
      treatments.forEach((t, index) => {
        this.logger.log(`  ${index + 1}. ${format(t.createdAt, 'yyyy-MM-dd HH:mm')} (${format(t.createdAt, 'EEEE')}) - ${t.status}`);
      });
    } else {
      this.logger.warn(`⚠️ No se encontraron tratamientos en el rango`);
    }

    // ============================================================
    // 📊 INICIALIZAR MAPAS
    // ============================================================
    const dayMap = new Map<string, {
      dayOfWeek: number;
      statuses: Map<string, number>;
    }>();

    const globalStatusMap = new Map<string, number>();

    let currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      dayMap.set(dateStr, {
        dayOfWeek: currentDate.getDay(),
        statuses: new Map<string, number>()
      });
      currentDate = addDays(currentDate, 1);
    }

    // ============================================================
    // 📊 PROCESAR TRATAMIENTOS
    // ============================================================
    treatments.forEach(treatment => {
      const dateStr = format(treatment.createdAt, 'yyyy-MM-dd');
      const status = treatment.status;

      const dayData = dayMap.get(dateStr);
      if (dayData) {
        const statusCount = dayData.statuses.get(status) || 0;
        dayData.statuses.set(status, statusCount + 1);
      }

      const globalCount = globalStatusMap.get(status) || 0;
      globalStatusMap.set(status, globalCount + 1);
    });

    // ============================================================
    // 📊 CONSTRUIR RESULTADO
    // ============================================================
    const days = Array.from(dayMap.entries()).map(([date, data]) => {
      const statusesObj: { [key: string]: number } = {};
      let total = 0;

      data.statuses.forEach((count, status) => {
        statusesObj[status] = count;
        total += count;
      });

      return {
        date,
        dayOfWeek: data.dayOfWeek,
        statuses: statusesObj,
        total
      };
    });

    const totalTreatments = treatments.length;
    const statusBreakdown = Array.from(globalStatusMap.entries()).map(([status, count]) => ({
      status,
      count,
      percentage: totalTreatments > 0 ? (count / totalTreatments) * 100 : 0
    }));

    statusBreakdown.sort((a, b) => b.count - a.count);

    // ============================================================
    // 🔍 LOG DE RESULTADOS
    // ============================================================
    this.logger.log(`📊 Desglose por estado:`);
    statusBreakdown.forEach(item => {
      this.logger.log(`  - ${item.status}: ${item.count} tratamientos (${item.percentage.toFixed(1)}%)`);
    });

    this.logger.log(`📊 Distribución por día:`);
    days.forEach(day => {
      if (day.total > 0) {
        const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][day.dayOfWeek];
        this.logger.log(`  - ${dayName} (${day.date}): ${day.total} tratamientos`);
        Object.entries(day.statuses).forEach(([status, count]) => {
          this.logger.log(`      ${status}: ${count}`);
        });
      }
    });

    this.logger.log(`📊 TOTAL: ${totalTreatments} tratamientos en la semana`);
    this.logger.log(`========================================`);

    return {
      weekStart: format(start, 'yyyy-MM-dd'),
      weekEnd: format(end, 'yyyy-MM-dd'),
      total: totalTreatments,
      statusBreakdown,
      days,
    };
  }

  // ============================================================
  // 7. PRÓXIMA CITA (sin importar la semana)
  // ============================================================
  async getNextAppointments(
    clinicId: number,
    doctorId?: number,
    limit: number = 2,
  ): Promise<TodayAppointment[]> {
    this.logger.log(`Getting next ${limit} appointments for clinic ${clinicId}`);

    const now = new Date();

    const where: any = {
      clinicId,
      appointmentDate: { gte: now },
      status: {
        notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'],
      },
    };

    if (doctorId) {
      where.doctorId = doctorId;
    }

    const appointments = await this.prisma.appointment.findMany({
      where,
      orderBy: { appointmentDate: 'asc' },
      take: limit,
      include: {
        patient: {
          select: {
            fullName: true,
            photoUrl: true,
            phoneNumber: true,
          },
        },
        doctor: {
          select: { name: true },
        },
        treatment: {
          select: { name: true },
        },
      },
    });

    return appointments.map((apt) => ({
      id: apt.id,
      patientName: apt.patient?.fullName || 'Paciente',
      patientPhoto: apt.patient?.photoUrl || null,
      patientPhone: apt.patient?.phoneNumber || null,
      treatment: apt.treatment?.name || 'Consulta general',
      time: format(apt.appointmentDate, 'HH:mm'),
      status: apt.status,
      duration: apt.duration || 30,
      doctorName: apt.doctor?.name || 'Doctor',
      date: format(apt.appointmentDate, 'yyyy-MM-dd'),
    }));
  }

  // ============================================================
  // 8. ALERTAS DEL DASHBOARD
  // ============================================================
  async getAlerts(clinicId: number): Promise<DashboardAlertsResponseDto> {
    this.logger.log(`🔔 Getting dashboard alerts for clinic ${clinicId}`);

    const now = new Date();
    const endOfTomorrow = endOfDay(addDays(now, 1));
    const sevenDaysAgo = subDays(now, 7);
    const fifteenDaysAgo = subDays(now, 15);

    // ═══════════════════════════════════════════════════════════
    // CONSULTAS EN PARALELO
    // ═══════════════════════════════════════════════════════════
    const [
      unconfirmedAppointments,
      noShowAppointments,
      inProgressAppointments,
      cancelledCount,
      pendingTreatments,
      pendingPayments,
    ] = await Promise.all([
      // 1. Citas sin confirmar (hoy + mañana) — SIN límite de semana
      this.prisma.appointment.findMany({
        where: {
          clinicId,
          appointmentDate: { gte: now, lte: endOfTomorrow },
          status: 'SCHEDULED',
        },
        include: {
          patient: { select: { fullName: true } },
        },
        orderBy: { appointmentDate: 'asc' },
        take: 50,
      }),

      // 2. No-shows últimos 7 días
      this.prisma.appointment.findMany({
        where: {
          clinicId,
          appointmentDate: { gte: sevenDaysAgo, lte: now },
          status: 'NO_SHOW',
        },
        include: {
          patient: { select: { fullName: true } },
        },
        orderBy: { appointmentDate: 'desc' },
        take: 50,
      }),

      // 3. Pacientes en consulta ahora
      this.prisma.appointment.findMany({
        where: {
          clinicId,
          status: 'IN_PROGRESS',
        },
        include: {
          patient: { select: { fullName: true } },
        },
        take: 20,
      }),

      // 4. Canceladas últimos 7 días
      this.prisma.appointment.count({
        where: {
          clinicId,
          appointmentDate: { gte: sevenDaysAgo },
          status: 'CANCELLED',
        },
      }),

      // 5. Tratamientos activos sin sesión hace +15 días
      this.prisma.treatment.findMany({
        where: {
          clinicId,
          status: 'IN_PROGRESS',
          createdAt: { lte: fifteenDaysAgo },
          sessions: {
            none: {
              sessionDate: { gte: fifteenDaysAgo },
            },
          },
        },
        include: {
          clinicalHistory: {
            include: {
              patient: { select: { fullName: true } },
            },
          },
        },
        take: 50,
      }),

      // 6. ⭐ TODOS los saldos pendientes (sin filtro de fecha)
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
          clinicalHistory: {
            select: {
              patient: { select: { fullName: true } },
            },
          },
        },
        orderBy: { remainingBalance: 'desc' }, // ⭐ los que más deben, primero
        take: 100,
      }),
    ]);

    // ═══════════════════════════════════════════════════════════
    // CONSTRUIR ALERTAS
    // ═══════════════════════════════════════════════════════════
    const alerts: DashboardAlertDto[] = [];

    // Alerta 1: Sin confirmar
    if (unconfirmedAppointments.length > 0) {
      const count = unconfirmedAppointments.length;
      alerts.push({
        type: 'UNCONFIRMED_APPOINTMENTS',
        severity: 'warning',
        count,
        label: `${count} ${count === 1 ? 'cita sin confirmar' : 'citas sin confirmar'}`,
        description: 'Para hoy o mañana',
        href: '/appointments?status=SCHEDULED&range=today-tomorrow',
        metadata: {
          sampleNames: unconfirmedAppointments
            .slice(0, 3)
            .map((a) => a.patient?.fullName)
            .filter((n): n is string => !!n),
        },
      });
    }

    // Alerta 2: No-shows
    if (noShowAppointments.length > 0) {
      const count = noShowAppointments.length;
      alerts.push({
        type: 'NO_SHOW',
        severity: 'critical',
        count,
        label: `${count} ${count === 1 ? 'paciente no asistió' : 'pacientes no asistieron'}`,
        description: 'Últimos 7 días',
        href: '/appointments?status=NO_SHOW&range=last-7-days',
        metadata: {
          sampleNames: noShowAppointments
            .slice(0, 3)
            .map((a) => a.patient?.fullName)
            .filter((n): n is string => !!n),
        },
      });
    }

    // Alerta 3: En consulta ahora
    if (inProgressAppointments.length > 0) {
      const count = inProgressAppointments.length;
      alerts.push({
        type: 'IN_PROGRESS',
        severity: 'success',
        count,
        label: `${count} ${count === 1 ? 'paciente en consulta' : 'pacientes en consulta'}`,
        description: 'Ahora mismo',
        href: '/appointments?status=IN_PROGRESS',
        metadata: {
          sampleNames: inProgressAppointments
            .slice(0, 3)
            .map((a) => a.patient?.fullName)
            .filter((n): n is string => !!n),
        },
      });
    }

    // Alerta 4: Canceladas
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

    // Alerta 5: Tratamientos sin sesión reciente
    if (pendingTreatments.length > 0) {
      const count = pendingTreatments.length;
      alerts.push({
        type: 'PENDING_TREATMENTS',
        severity: 'warning',
        count,
        label: `${count} ${count === 1 ? 'tratamiento sin sesión' : 'tratamientos sin sesión'}`,
        description: 'Hace más de 15 días',
        href: '/treatments?status=IN_PROGRESS&stale=15',
        metadata: {
          sampleNames: pendingTreatments
            .slice(0, 3)
            .map((t) => t.clinicalHistory?.patient?.fullName)
            .filter((n): n is string => !!n),
        },
      });
    }

    // ⭐ Alerta 6: Saldos pendientes (TODOS)
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
          sampleNames: pendingPayments
            .slice(0, 3)
            .map((t) => t.clinicalHistory?.patient?.fullName)
            .filter((n): n is string => !!n),
        },
      });
    }

    // ═══════════════════════════════════════════════════════════
    // RESULTADO
    // ═══════════════════════════════════════════════════════════
    this.logger.log(`🔔 Alerts found: ${alerts.length}`);

    return {
      alerts,
      totalCount: alerts.length,
      generatedAt: now.toISOString(),
    };
  }
}