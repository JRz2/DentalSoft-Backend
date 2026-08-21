import { ApiPropertyOptional } from "@nestjs/swagger";
import { TreatmentType, TreatmentStatus } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";

export class UpdateTreatmentDto {
    @ApiPropertyOptional({ example: 'Endodoncia Molar 36', description: 'Nombre del tratamiento' })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional({ example: 'Tratamiento de conducto para el molar 36', description: 'Descripción del tratamiento' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ enum: TreatmentType, example: 'ENDODONTIC' })
    @IsEnum(TreatmentType)
    @IsOptional()
    type?: TreatmentType;

    @ApiPropertyOptional({ example: 5, description: 'Número estimado de sesiones' })
    @IsInt()
    @Min(0)
    @IsOptional()
    estimatedSessions?: number;

    @ApiPropertyOptional({ enum: TreatmentStatus, example: 'IN_PROGRESS' })
    @IsEnum(TreatmentStatus)
    @IsOptional()
    status?: TreatmentStatus;

    @ApiPropertyOptional({ example: '2026-08-18T00:00:00.000Z' })
    @IsOptional()
    startDate?: Date;

    @ApiPropertyOptional({ example: '2026-09-18T00:00:00.000Z' })
    @IsOptional()
    endDate?: Date;
}