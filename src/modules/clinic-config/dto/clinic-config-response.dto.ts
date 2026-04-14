import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClinicConfigResponseDto {
    @ApiProperty()
    id: number;

    @ApiPropertyOptional()
    businessName?: string;

    @ApiPropertyOptional()
    commercialName?: string;

    @ApiPropertyOptional()
    nit?: string;

    @ApiPropertyOptional()
    address?: string;

    @ApiPropertyOptional()
    mobile?: string;

    @ApiPropertyOptional()
    email?: string;

    @ApiPropertyOptional()
    website?: string;

    @ApiPropertyOptional()
    legalRepresentative?: string;

    @ApiPropertyOptional()
    legalRepresentativeId?: string;

    @ApiPropertyOptional()
    contactName?: string;

    @ApiPropertyOptional()
    contactPhone?: string;

    @ApiPropertyOptional()
    logoUrl?: string;

    @ApiPropertyOptional()
    faviconUrl?: string;

    @ApiPropertyOptional()
    headerImageUrl?: string;

    @ApiPropertyOptional()
    footerText?: string;

    @ApiPropertyOptional()
    registrationNumber?: string;

    @ApiPropertyOptional()
    licenseNumber?: string;

    @ApiPropertyOptional()
    socialMedia?: any;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}