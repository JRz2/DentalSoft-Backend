import { IsOptional, IsDateString } from 'class-validator';

export class PaymentKpisQueryDto {
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;
}