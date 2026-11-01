import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { PaymentMethodType, PaymentStatusType } from '@prisma/client';

export class PaymentQueryDto {
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @IsEnum(PaymentMethodType)
    paymentMethod?: PaymentMethodType;

    @IsOptional()
    @IsEnum(PaymentStatusType)
    status?: PaymentStatusType;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsString()
    page?: string;

    @IsOptional()
    @IsString()
    limit?: string;
}