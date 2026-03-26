import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateClinicalHistoryDto } from './create-clinical-history.dto';
import { IsObject, IsOptional } from 'class-validator';

export class UpdateClinicalHistoryDto extends PartialType(CreateClinicalHistoryDto) {
    @ApiPropertyOptional({ description: 'Odontograma', example: 'Caries',})
    @IsObject()
    @IsOptional()
    odontogram?: any;

    @ApiPropertyOptional({ description: 'Antecedentes Médicos', example: 'hipertensión',})
    @IsObject()
    @IsOptional()
    medicalHistory?: any;
    
    @ApiPropertyOptional({ description: 'Alergias', example: 'Penicilina',})
    @IsObject()
    @IsOptional()
    allergies?: any;

    @ApiPropertyOptional({ description: 'Observaciones', example: 'Paciente presenta dolor en la mandíbula',})
    @IsObject()
    @IsOptional()
    observations?: any;
}
