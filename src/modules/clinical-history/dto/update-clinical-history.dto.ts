import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateClinicalHistoryDto } from './create-clinical-history.dto';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateClinicalHistoryDto extends PartialType(CreateClinicalHistoryDto) {
    @ApiPropertyOptional({ description: 'Odontograma', example: 'Caries',})
    @IsObject()
    @IsOptional()
    odontogram?: any;

    @ApiPropertyOptional({ description: 'Antecedentes Médicos', example: 'hipertensión',})
    @IsString()
    @IsOptional()
    medicalHistory?: string;
    
    @ApiPropertyOptional({ description: 'Alergias', example: 'Penicilina',})
    @IsString()
    @IsOptional()
    allergies?: string;

    @ApiPropertyOptional({ description: 'Observaciones', example: 'Paciente presenta dolor en la mandíbula',})
    @IsString()
    @IsOptional()
    observations?: string;
}
