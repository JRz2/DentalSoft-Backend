import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsOptional, Min } from 'class-validator';

export class UpdateCostDto {
    @ApiProperty({ example: 300000, description: 'Costo total del tratamiento' })
    @IsNumber()
    @IsPositive()
    @Min(1)
    totalCost: number;

    @ApiPropertyOptional({ example: 0, description: 'Descuento aplicado' })
    @IsNumber()
    @IsOptional()
    @Min(0)
    discount?: number;
}