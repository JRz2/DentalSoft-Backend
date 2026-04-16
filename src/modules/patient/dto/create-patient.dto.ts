import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsEmail, IsOptional, IsDateString, IsPhoneNumber, MinLength, MaxLength, IsBoolean, IsInt } from 'class-validator';

export class CreatePatientDto {
    @ApiProperty({
        example: 'Juan Pérez',
        description: 'Nombre completo del paciente',
        minLength: 3,
        maxLength: 100,
    })
    @IsString()
    @MinLength(3)
    @MaxLength(100)
    fullName: string;

    @ApiProperty({
        example: '+59178945612',
        description: 'Número de teléfono del paciente',
    })
    @IsString()
    phoneNumber: string;

    @ApiProperty({
        example: 'juan.perez@example.com',
        description: 'Correo electrónico del paciente',
    })
    @IsEmail()
    @IsOptional()
    email: string;

    @ApiProperty({
        example: '1990-01-15',
        description: 'Fecha de nacimiento (YYYY-MM-DD)',
    })
    @IsOptional()
    @IsDateString()
    birthDate: string;

    @ApiPropertyOptional({
        example: 'Calle Falsa 123, Ciudad, País',
        description: 'Dirección del paciente',
    })
    @IsString()
    @IsOptional()
    address?: string;

    @ApiPropertyOptional({
        example: 'Historial clínico del paciente',
        description: 'Información adicional sobre el historial clínico del paciente',
    })
    @IsString()
    @IsOptional()
    dentalHistory?: string;

    @ApiPropertyOptional({
        description: 'Hábitos del paciente (tabaco, alcohol, bruxismo)',
        example: 'Fumador ocasional, bruxismo nocturno',
    })
    @IsString()
    @IsOptional()
    habits?: string;

    @ApiPropertyOptional({
        description: 'Condiciones médicas relevantes',
        example: 'Hipertensión, alergia a la penicilina',
    })
    @IsString()
    @IsOptional()
    medicalConditions?: string;

    @ApiPropertyOptional({ default: true })
    @IsBoolean()
    @IsOptional()
    IsActive?: boolean;

    @ApiPropertyOptional({ description: 'ID de la clínica (solo SUPER_ADMIN)' })
    @IsInt()
    @IsOptional()
    clinicId?: number;
}