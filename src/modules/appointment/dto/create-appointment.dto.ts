import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class CreateAppointmentDto {
    @ApiProperty({ example: '1', description: 'ID del paciente' })
    @IsInt()
    patientId: number;

    @ApiProperty({ example: '1', description: 'ID del doctor' })
    @IsInt()
    doctorId: number;

    @ApiProperty({ example: '2024-07-01T10:00:00Z', description: 'Fecha y hora de la cita' })
    @IsDateString()
    appointmentDate: string;

    @ApiProperty({ example: 'Consulta general', description: 'Motivo de la cita' })
    @IsString()
    @MinLength(3)
    reason: string;

    @ApiPropertyOptional({ example: 'Paciente con dolor agudo', description: 'Notas adicionales sobre la cita' })
    @IsString()
    @IsOptional()
    notes?: string;

    @ApiPropertyOptional({ example: '30', description: 'Duración de la cita en minutos', default: 30 })
    @IsInt()
    @IsOptional()
    duration?: number;

    @ApiPropertyOptional({ example: 1, description: 'ID del tratamiento asociado (opcional)' })
    @IsInt()
    @IsOptional()
    treatmentId?: number;

    @ApiPropertyOptional({ example: true, description: 'Permitir citas en fechas pasadas', default: false })
    @IsOptional()
    @IsBoolean()
    allowPastDate?: boolean;
}
