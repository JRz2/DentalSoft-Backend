import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsOptional, Min, IsString, MaxLength } from 'class-validator';

export class UpdateCostDto {
    @ApiProperty({ example: 300000, description: 'Costo total del tratamiento' })
    @IsNumber()
    @IsPositive()
    @Min(0, { message: 'El costo no puede ser negativo' })
    totalCost: number;

    @ApiPropertyOptional({ example: 0, description: 'Descuento aplicado' })
    @IsNumber()
    @IsOptional()
    @Min(0)
    discount?: number;

    @ApiPropertyOptional({ example: 'Se agregaron 2 sesiones adicionales', description: 'Motivo del cambio de costo' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}