import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class DoctorInfo {
    @ApiProperty({ example: 1, description: 'ID del doctor' })
    id: number;

    @ApiProperty({ example: 'Dr. Smith', description: 'Nombre del doctor' })
    name: string;

    @ApiProperty({ example: 'Ortodoncia', description: 'Especialidad del doctor' })
    specialty: string;
}

export class PatientResponseDto {
    @ApiProperty({ example: 1, description: 'ID del paciente' })
    id: number;

    @ApiProperty({ example: 'Juan Pérez', description: 'Nombre completo' })
    fullName: string;

    @ApiProperty({ example: '+573001234567', description: 'Teléfono' })
    phoneNumber: string;

    @ApiPropertyOptional({ example: 'juan@email.com', description: 'Email' })
    email?: string;

    @ApiProperty({ example: '1990-01-15', description: 'Fecha de nacimiento' })
    birthDate: Date;

    @ApiPropertyOptional({ example: 'Calle 123', description: 'Dirección' })
    address?: string;

    @ApiPropertyOptional({ description: 'Historia dental previa' })
    dentalHistory?: string;

    @ApiPropertyOptional({ description: 'Hábitos' })
    habits?: string;

    @ApiPropertyOptional({ description: 'Condiciones médicas' })
    medicalConditions?: string;

    @ApiProperty({ example: 'P-2024-00001', description: 'Número de historia clínica' })
    medicalRecordNum: string;

    @ApiProperty({ example: 1, description: 'ID del doctor que registró' })
    registeredBy: number;

    @ApiProperty({ description: 'Doctor que registró', type: () => DoctorInfo })
    doctor?: DoctorInfo;

    @ApiProperty({ nullable: true }) 
    deletedAt?: Date | null; 

    @ApiProperty({ example: '2024-01-15T10:30:00Z', description: 'Fecha de creación' })
    createdAt: Date;

    @ApiProperty({ example: '2024-01-15T10:30:00Z', description: 'Última actualización' })
    updatedAt: Date;
}