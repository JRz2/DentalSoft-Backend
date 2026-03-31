import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class CreateAppointmentDto {
    @ApiProperty({ example: '1', description: 'ID del paciente'})
    @IsInt()
    patientId: number;

    @ApiProperty({ example: '1', description: 'ID del doctor'})
    @IsInt()
    doctorId: number;

    @ApiProperty({ example: '2024-07-01T10:00:00Z', description: 'Fecha y hora de la cita'})
    @IsInt()
    appointmentDate: Date;

    @ApiProperty({ example: 'Consulta general', description: 'Motivo de la cita'})
    @IsString()
    @MinLength(3)
    reason: string;

    @ApiPropertyOptional({ example: 'Paciente con dolor agudo', description: 'Notas adicionales sobre la cita'})
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
}
