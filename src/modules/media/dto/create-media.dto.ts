import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MediaType, MediaCategory } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateMediaDto {
    @ApiProperty({ example: 1, description: 'ID del tratamiento' })
    @IsInt()
    @Min(1)
    treatmentId: number;

    @ApiPropertyOptional({ example: 1, description: 'ID de la sesión (opcional)' })
    @IsInt()
    @Min(1)
    @IsOptional()
    sessionId?: number;

    @ApiProperty({ enum: MediaType, example: 'IMAGE' })
    @IsEnum(MediaType)
    mediaType: MediaType;

    @ApiPropertyOptional({ enum: MediaCategory, example: 'PRE_OPERATIVE' })
    @IsEnum(MediaCategory)
    @IsOptional()
    category?: MediaCategory;

    @ApiPropertyOptional({ example: 'Radiografía preoperatoria' })
    @IsString()
    @IsOptional()
    title?: string;

    @ApiPropertyOptional({ example: 'Radiografía del molar 36 antes del tratamiento' })
    @IsString()
    @IsOptional()
    description?: string;
}

export class CreateMediaFromB2Dto extends CreateMediaDto {
    @ApiProperty({ example: 'media/1/uuid.png', description: 'El key o ruta del archivo en Backblaze B2' })
    @IsString()
    filePath: string;

    @ApiProperty({ example: 'foto-paciente.png', description: 'Nombre original del archivo' })
    @IsString()
    fileName: string;

    @ApiProperty({ example: 102400, description: 'Tamaño del archivo en bytes' })
    @IsInt()
    @Min(1)
    fileSize: number;

    @ApiProperty({ example: 'image/png', description: 'Tipo MIME del archivo' })
    @IsString()
    mimeType: string;
}