import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AppointmentResponseDto {
    @ApiProperty()
    id: number;

    @ApiProperty()
    pacientId: number;

    @ApiPropertyOptional()
    patient?: {
        id: number;
        fullName: string;
        phoneNumber: string;
    };

    @ApiProperty()
    doctorId: number;

    @ApiPropertyOptional()
    doctor?: {
        id: number;
        name: string;
        specialty: string;
    };

    @ApiProperty()
    appointmentDate: Date;

    @ApiProperty()
    duration: number;

    @ApiProperty()
    status: string;

    @ApiProperty()
    reason: string;

    @ApiPropertyOptional()
    diagnosis?: string;

    @ApiPropertyOptional()
    notes?: string;

    @ApiPropertyOptional()
    treatmentId?: number;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    @ApiPropertyOptional()
    cancelledAt?: Date;

    @ApiPropertyOptional()
    cancellationReason?: string;
}