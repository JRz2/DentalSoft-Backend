import { PartialType } from '@nestjs/mapped-types';
import { CreatePatientDto } from './create-patient.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUrl, IsOptional } from 'class-validator';

export class UpdatePatientDto extends PartialType(CreatePatientDto) {
    @ApiPropertyOptional({
        description: 'Estado del paciente (activo/inactivo)',
        example: 'true',
    })
    IsActive?: boolean;

    @ApiPropertyOptional({
        description: 'URL de la foto del paciente',
        example: 'https://example.com/photo.jpg',
    })
    @IsUrl()
    @IsOptional()
    photoUrl?: string;
}
