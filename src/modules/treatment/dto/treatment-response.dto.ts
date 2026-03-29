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

}