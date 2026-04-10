import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsObject, IsOptional, IsString } from "class-validator";

export class CreateTreatmentSessionDto {
    @ApiProperty({ example: '1', description: 'ID del tratamiento' })
    @IsInt()
    treatmentId: number;

    @ApiProperty({ example: '1', description: 'Número de sesiones' })
    @IsInt()
    sessionNumber: number;

    @ApiProperty({ example: 'Apertura coronaria', description: 'Descripción de la sesión de tratamiento' })
    @IsString()
    description: string;

    @ApiPropertyOptional({ description: 'Notas adicionales' })
    @IsString()
    @IsOptional()
    notes?: string;

    @ApiPropertyOptional({ description: 'Procediemiento realizado durante la sesión de tratamiento' })
    @IsObject()
    @IsOptional()
    procedures?: any;

    @ApiProperty({ example: '2024-07-01T10:00:00Z', description: 'Fecha y hora de la sesión de tratamiento' })
    @IsString()
    @IsOptional()
    sessionDate?: string;

    @ApiPropertyOptional({ example: '1', description: 'ID de la cita asociada' })
    @IsInt()
    @IsOptional()
    appointmentId?: number;

}
