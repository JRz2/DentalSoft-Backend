import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsEmail } from 'class-validator';

export class CreateClinicDto {
    @ApiProperty({ example: 'Clínica Dental' })
    @IsString()
    name: string;

    @ApiPropertyOptional({ example: 'Calle Principal #123' })
    @IsString()
    @IsOptional()
    address?: string;

    @ApiPropertyOptional({ example: '+573001234567' })
    @IsString()
    @IsOptional()
    phone?: string;

    @ApiPropertyOptional({ example: 'info@clinica.com' })
    @IsEmail()
    @IsOptional()
    @Transform(({ value }) => value === '' ? undefined : value)
    email?: string;

    @ApiPropertyOptional({ example: 'sonrisadental' })
    @IsString()
    @IsOptional()
    subdomain: string;

    @ApiPropertyOptional({ example: 'https://ejemplo.com/logo.png' })
    @IsString()
    @IsOptional()
    logoUrl?: string;

    @ApiPropertyOptional({ example: 'https://ejemplo.com/favicon.png' })
    @IsString()
    @IsOptional()
    faviconUrl?: string;
}