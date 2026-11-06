import { IsOptional, IsEnum, IsDateString, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export enum TreatmentStatus {
    PLANNED = 'PLANNED',
    IN_PROGRESS = 'IN_PROGRESS',
    ON_HOLD = 'ON_HOLD',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

export enum AppointmentStatus {
    SCHEDULED = 'SCHEDULED',
    CONFIRMED = 'CONFIRMED',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
    NO_SHOW = 'NO_SHOW',
}

export enum RevenuePeriod {
    DAILY = 'daily',
    WEEKLY = 'weekly',
    MONTHLY = 'monthly',
}

// ============ QUERY DTOs ============
export class AppointmentsQueryDto {
    @IsOptional()
    @IsDateString()
    date?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    doctorId?: number;
}

export class RevenueQueryDto {
    @IsOptional()
    @IsEnum(RevenuePeriod)
    period: RevenuePeriod = RevenuePeriod.MONTHLY;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @IsInt()
    @Type(() => Number)
    doctorId?: number;
}

export class WeeklyActivityQueryDto {
    @IsOptional()
    @IsDateString()
    date?: string;

    @IsOptional()
    @IsInt()
    @Type(() => Number)
    doctorId?: number;

    @IsOptional()
    @IsString()
    weekStart?: string;

    @IsOptional()
    @IsString()
    weekEnd?: string;

    @IsOptional()
    @IsEnum(AppointmentStatus)
    status?: string;
}

// ============ INTERFACES ============
export interface DashboardStats {
    totalPatients: number;
    pendingAppointments: number;
    activeTreatments: number;
    monthlyIncome: number;
}

export interface DailyActivity {
    date: string;
    dayOfWeek: number;
    patientsCount: number;
    isHoliday: boolean;
    holidayName: string | null;
}

export interface WeeklyActivity {
    weekStart: string;
    weekEnd: string;
    days: DailyActivity[];
    total: number;
    max: number;
    average: number;
}

export interface TodayAppointment {
    id: number;
    patientName: string;
    patientPhoto: string | null;
    patientPhone?: string | null;
    treatment: string;
    time: string;
    date: string;
    appointmentDate?: string;
    status: string;
    duration: number;
    doctorName?: string;
}

export interface MonthlyData {
    year: number;
    month: number;
    daysWithAppointments: number[];
    totalAppointments: number;
}

export interface RevenueData {
    period: RevenuePeriod;
    startDate: string;
    endDate: string;
    total: number;
    breakdown: RevenueBreakdown[];
}

export interface RevenueBreakdown {
    date: string;
    amount: number;
    count: number;
}

export interface TreatmentDistribution {
    status: string;
    count: number;
    percentage: number;
}

export interface NewPatient {
    id: number;
    fullName: string;
    email: string | null;
    phoneNumber: string | null;
    createdAt: string;
}

export interface NewPatientsData {
    period: 'week' | 'month';
    total: number;
    patients: NewPatient[];
}

export interface WeekAppointmentsResponse {
    weekStart: string;
    weekEnd: string;
    total: number;
    appointments: TodayAppointment[];
}

export interface DailyTreatmentActivity {
    date: string;
    dayOfWeek: number;
    treatmentsCount: number;
    isHoliday: boolean;
    holidayName: string | null;
}

export interface WeeklyTreatmentActivity {
    weekStart: string;
    weekEnd: string;
    days: DailyTreatmentActivity[];
    total: number;
    max: number;
    average: number;
}

export interface TreatmentStatusBreakdown {
    status: string;
    count: number;
    percentage: number;
}

export interface WeeklyTreatmentByStatus {
    weekStart: string;
    weekEnd: string;
    total: number;
    statusBreakdown: TreatmentStatusBreakdown[];
    days: {
        date: string;
        dayOfWeek: number;
        statuses: {
            [key: string]: number;
        };
        total: number;
    }[];
}

export interface WeeklyTreatmentDetail {
    id: number;
    name: string;
    description: string | null;
    type: string;
    status: string;
    patientName: string;
    doctorName: string | null;
    totalCost: number | null;
    createdAt: string;
    date: string;
    time: string;
}

export interface WeeklyTreatmentListResponse {
    weekStart: string;
    weekEnd: string;
    total: number;
    treatments: WeeklyTreatmentDetail[];
}

export class TreatmentActivityQueryDto {
    @IsOptional()
    @IsDateString()
    date?: string;

    @IsOptional()
    @IsDateString()
    weekStart?: string;

    @IsOptional()
    @IsDateString()
    weekEnd?: string;

    @IsOptional()
    @IsEnum(TreatmentStatus)
    status?: TreatmentStatus;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    doctorId?: number;
}