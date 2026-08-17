import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TreatmentType, TreatmentStatus, PaymentMethodType } from "@prisma/client";
import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from "class-validator";

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

    @ApiPropertyOptional({ enum: TreatmentStatus, default: 'PLANED' })
    @IsEnum(TreatmentStatus)
    @IsOptional()
    status?: TreatmentStatus;

    @ApiPropertyOptional({ example: 150000, description: 'Costo total del tratamiento' })
    @IsInt()
    @Min(1)
    totalCost?: number

    @ApiPropertyOptional({ example: 150000 })
    @IsNumber()
    @IsPositive()
    @IsOptional()
    paymentAmount?: number;

    @ApiPropertyOptional({ enum: PaymentMethodType, example: 'CASH' })
    @IsEnum(PaymentMethodType)
    @IsOptional()
    paymentMethod?: PaymentMethodType;

    @ApiPropertyOptional({ example: 'Voucher #123' })
    @IsString()
    @IsOptional()
    paymentReference?: string;
}
