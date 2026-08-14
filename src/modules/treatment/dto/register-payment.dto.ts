import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsEnum, IsString, IsOptional, Min } from 'class-validator';
import { PaymentMethodType } from '@prisma/client';

export class RegisterPaymentDto {
    @ApiProperty({ example: 150000, description: 'Monto a pagar' })
    @IsNumber()
    @IsPositive()
    @Min(1)
    amount: number;

    @ApiProperty({ enum: PaymentMethodType, example: 'CASH', description: 'Método de pago' })
    @IsEnum(PaymentMethodType)
    paymentMethod: PaymentMethodType;

    @ApiPropertyOptional({ example: 'Voucher #12345', description: 'Número de referencia' })
    @IsString()
    @IsOptional()
    reference?: string;

    @ApiPropertyOptional({ example: 'Pago inicial de endodoncia', description: 'Notas adicionales' })
    @IsString()
    @IsOptional()
    notes?: string;
}