import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsInt } from "class-validator";

export class AvailableSlotsDto {
    @ApiProperty({ example: '1', description: 'ID del doctor' })
    @IsInt()
    doctorId: number;

    @ApiProperty({ example: '2024-07-01', description: 'Fecha para consultar los horarios disponibles (YYYY-MM-DD)' })
    @IsDateString()
    date: string;
}