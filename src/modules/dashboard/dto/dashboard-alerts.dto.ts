import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';

export type AlertType =
    | 'UNCONFIRMED_APPOINTMENTS'
    | 'NO_SHOW'
    | 'IN_PROGRESS'
    | 'CANCELLED'
    | 'PENDING_TREATMENTS'
    | 'PENDING_PAYMENTS';

export class DashboardAlertMetadataDto {
    @ApiPropertyOptional({ example: ['Juan Pérez', 'María García'] })
    sampleNames?: string[];

    @ApiPropertyOptional({ example: 4250.5 })
    totalAmount?: number;

    @ApiPropertyOptional({ example: 45 })
    daysOld?: number;
}

export class DashboardAlertDto {
    @ApiProperty({ example: 'UNCONFIRMED_APPOINTMENTS' })
    type: AlertType;

    @ApiProperty({ example: 'warning', enum: ['critical', 'warning', 'info', 'success'] })
    severity: AlertSeverity;

    @ApiProperty({ example: 3 })
    count: number;

    @ApiProperty({ example: '3 citas sin confirmar' })
    label: string;

    @ApiProperty({ example: 'Para hoy o mañana' })
    description: string;

    @ApiProperty({ example: '/appointments?status=SCHEDULED&range=today-tomorrow' })
    href: string;

    @ApiPropertyOptional({ type: DashboardAlertMetadataDto })
    metadata?: DashboardAlertMetadataDto;
}

export class DashboardAlertsResponseDto {
    @ApiProperty({ type: [DashboardAlertDto] })
    alerts: DashboardAlertDto[];

    @ApiProperty({ example: 2 })
    totalCount: number;

    @ApiProperty({ example: '2026-10-12T14:30:00.000Z' })
    generatedAt: string;
}