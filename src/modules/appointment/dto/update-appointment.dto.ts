import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateAppointmentDto } from './create-appointment.dto';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {
    @ApiPropertyOptional({ enum: AppointmentStatus, description: 'Estado de la cita' })
    @IsInt()
    @IsEnum(AppointmentStatus)
    @IsOptional()
    status?: AppointmentStatus;
}
