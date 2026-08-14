import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TreatmentResponseDto {
    @ApiProperty()
    id: number;

    @ApiProperty()
    clinicalHistoryId: number;

    @ApiProperty()
    name: string;

    @ApiPropertyOptional()
    description?: string;

    @ApiPropertyOptional()
    type?: string;

    @ApiProperty()
    estimatedSessions: number;

    @ApiProperty()
    status: string;

    @ApiProperty()
    starDate: Date;

    @ApiPropertyOptional()
    endDate?: Date;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    @ApiPropertyOptional({ description: 'Sesiones del tratamiento' })
    sessions?: any[];
    
    @ApiPropertyOptional({
        description: 'Datos del paciente asociado',
        type: 'object',
        properties: {
            id: { type: 'number' },
            fullName: { type: 'string' },
            phoneNumber: { type: 'string' },
            email: { type: 'string' },
            medicalRecordNum: { type: 'string' },
        },
    })
    patient?: {
        id: number;
        fullName: string;
        phoneNumber: string;
        email?: string;
        medicalRecordNum: string;
    };
}