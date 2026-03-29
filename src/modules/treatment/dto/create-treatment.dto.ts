import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TreatmentType, TreatmentStatus } from "@prisma/client";
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateTreatmentDto {
    @ApiProperty({ example: 'Endodoncia Molar 36', description: 'Nombre del tratamiento' })
    @IsString()
    name: string;

    @ApiPropertyOptional({ example: 'Tratamiento de conducto para el molar 36', description: 'Descripción del tratamiento' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ enum: TreatmentType, example: 'ENDODONTIC' })
    @IsEnum(TreatmentType)
    type: TreatmentType;

    @ApiProperty({ example: 5, description: 'Número estimado de sesiones' })
    @IsInt()
    @Min(1)
    estimatedSessions: number;

    @ApiPropertyOptional({enum: TreatmentStatus, default: 'PLANED'})
    @IsEnum(TreatmentStatus)
    @IsOptional()
    status?: TreatmentStatus;
}
