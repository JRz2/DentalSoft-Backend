import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TreatmentSessionResponseDto {
    @ApiProperty()
    id: number;

    @ApiProperty()
    treatmentId: number;

    @ApiProperty()
    sessionNumber: number;

    @ApiProperty()
    description: string;

    @ApiPropertyOptional()
    notes?: string;
    
    @ApiPropertyOptional()
    procedures?: any;

    @ApiProperty()
    appointmentId: number;

    @ApiProperty()
    sessionDate: Date;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    @ApiPropertyOptional({ description: 'Informacino de la cita asociada' })
    appointment?: {
        id: number;
        appointmentDate: Date;
        status: string;
    };
}