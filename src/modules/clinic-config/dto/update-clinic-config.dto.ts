import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsUrl, IsObject } from 'class-validator';

export class UpdateClinicConfigDto {

    @ApiPropertyOptional({ example: 'Clínica Dental Sonrisa S.A.S.' })
    @IsString()
    @IsOptional()
    businessName?: string;

    @ApiPropertyOptional({ example: 'Sonrisa Dental' })
    @IsString()
    @IsOptional()
    commercialName?: string;

    @ApiPropertyOptional({ example: '901234567-1' })
    @IsString()
    @IsOptional()
    nit?: string;

    @ApiPropertyOptional({ example: 'Calle 45 #23-12, Bogotá' })
    @IsString()
    @IsOptional()
    address?: string;

    @ApiPropertyOptional({ example: '+573001234567' })
    @IsString()
    @IsOptional()
    mobile?: string;

    @ApiPropertyOptional({ example: 'info@sonrisadental.com' })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiPropertyOptional({ example: 'www.sonrisadental.com' })
    @IsUrl()
    @IsOptional()
    website?: string;

    // Responsables
    @ApiPropertyOptional({ example: 'Dra. María González' })
    @IsString()
    @IsOptional()
    legalRepresentative?: string;

    @ApiPropertyOptional({ example: 'CC 12345678' })
    @IsString()
    @IsOptional()
    legalRepresentativeId?: string;

    @ApiPropertyOptional({ example: 'Juan Pérez' })
    @IsString()
    @IsOptional()
    contactName?: string;

    @ApiPropertyOptional({ example: '+573001234568' })
    @IsString()
    @IsOptional()
    contactPhone?: string;

    // Imagen y marca
    @ApiPropertyOptional({ example: 'https://bucket.s3.com/logo.png' })
    @IsUrl()
    @IsOptional()
    logoUrl?: string;

    @ApiPropertyOptional({ example: 'https://bucket.s3.com/favicon.ico' })
    @IsUrl()
    @IsOptional()
    faviconUrl?: string;

    @ApiPropertyOptional({ example: 'https://bucket.s3.com/header.jpg' })
    @IsUrl()
    @IsOptional()
    headerImageUrl?: string;

    @ApiPropertyOptional({ example: 'Gracias por confiar en nosotros' })
    @IsString()
    @IsOptional()
    footerText?: string;

    // Datos legales
    @ApiPropertyOptional({ example: 'RES-12345' })
    @IsString()
    @IsOptional()
    registrationNumber?: string;

    @ApiPropertyOptional({ example: 'LIC-2024-001' })
    @IsString()
    @IsOptional()
    licenseNumber?: string;

    @ApiPropertyOptional({
        description: 'Redes sociales en JSON',
        example: { facebook: '@sonrisadental', instagram: '@sonrisadental' }
    })
    @IsObject()
    @IsOptional()
    socialMedia?: any;
}