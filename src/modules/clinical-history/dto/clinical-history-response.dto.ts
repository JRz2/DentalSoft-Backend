import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ClinicalHistoryResponseDto {
    @ApiProperty({ example: '1' })
    id: number;

    @ApiProperty({ example: '1' })
    patientId: number;

    @ApiPropertyOptional({ description: 'Odontograma'})
    odontogram?: any;

    @ApiPropertyOptional({ description: 'Hipertensión'})
    medicalHistory?: any;

    @ApiPropertyOptional({ description: 'Penicilina'})
    allergies?: any;    

    @ApiPropertyOptional({ description: 'Paciente presenta dolor en la mandíbula'})
    observations?: any;

    @ApiProperty({ example: '2024-01-01T00:00:00Z' })
    createdAt: Date;

    @ApiProperty({ example: '2024-01-01T00:00:00Z' })
    updatedAt: Date;
}
