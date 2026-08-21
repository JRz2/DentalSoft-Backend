import { ApiPropertyOptional } from "@nestjs/swagger";
import { MediaType, MediaCategory } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class UpdateMediaDto {
    @ApiPropertyOptional({ enum: MediaType, example: 'XRAY' })
    @IsEnum(MediaType)
    @IsOptional()
    mediaType?: MediaType;

    @ApiPropertyOptional({ enum: MediaCategory, example: 'POST_OPERATIVE' })
    @IsEnum(MediaCategory)
    @IsOptional()
    category?: MediaCategory;

    @ApiPropertyOptional({ example: 'Radiografía postoperatoria' })
    @IsString()
    @IsOptional()
    title?: string;

    @ApiPropertyOptional({ example: 'Radiografía del molar 36 después del tratamiento' })
    @IsString()
    @IsOptional()
    description?: string;
}