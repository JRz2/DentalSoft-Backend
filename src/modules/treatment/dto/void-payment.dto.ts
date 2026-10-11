import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class VoidPaymentDto {
    @ApiProperty({ example: 'Pago duplicado por error de red' })
    @IsString()
    @MinLength(5, { message: 'El motivo debe tener al menos 5 caracteres' })
    @MaxLength(500, { message: 'El motivo no puede superar 500 caracteres' })
    reason: string;
}