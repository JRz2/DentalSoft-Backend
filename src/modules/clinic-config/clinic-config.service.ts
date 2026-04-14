import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateClinicConfigDto } from './dto/create-clinic-config.dto';
import { UpdateClinicConfigDto } from './dto/update-clinic-config.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClinicConfigResponseDto } from './dto/clinic-config-response.dto';

@Injectable()
export class ClinicConfigService {
  constructor(private prisma: PrismaService) { }

  private toResponseDto(config: any): ClinicConfigResponseDto {
    return {
      id: config.id,
      businessName: config.businessName,
      commercialName: config.commercialName,
      nit: config.nit,
      address: config.address,
      mobile: config.mobile,
      email: config.email,
      website: config.website,
      legalRepresentative: config.legalRepresentative,
      legalRepresentativeId: config.legalRepresentativeId,
      contactName: config.contactName,
      contactPhone: config.contactPhone,
      logoUrl: config.logoUrl,
      faviconUrl: config.faviconUrl,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  };

  async getConfig() {
    let config = await this.prisma.clinicConfig.findFirst();

    if (!config) {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

      config = await this.prisma.clinicConfig.create({
        data: {
          businessName: 'Clínica Dental Ejemplo',
          commercialName: 'Sonrisa Dental',
          nit: '900000000-1',
          address: 'Calle Principal #123',
          mobile: '+573001234567',
          email: 'info@sonrisadental.com',
          website: 'www.sonrisadental.com',
          legalRepresentative: 'Dr. Juan Perez',
          footerText: 'Gracias por confiar en nosotros',
          logoUrl: `${baseUrl}/assets/logo-default.png`,
          faviconUrl: `${baseUrl}/assets/favicon-default.ico`,
        },
      })
    }

    return this.toResponseDto(config);
  }
  create(createClinicConfigDto: CreateClinicConfigDto) {
    return 'This action adds a new clinicConfig';
  }

  findAll() {
    return `This action returns all clinicConfig`;
  }

  findOne(id: number) {
    return `This action returns a #${id} clinicConfig`;
  }

  async updateConfig(
    updateDto: UpdateClinicConfigDto,
    userId: number,
  ): Promise<ClinicConfigResponseDto> {
    const config = await this.prisma.clinicConfig.findFirst();

    if (!config) {
      throw new NotFoundException('Clinic configuration not found');
    }

    const updatedConfig = await this.prisma.$transaction(async (prisma) => {
      const updated = await prisma.clinicConfig.update({
        where: { id: config.id },
        data: {
          ...updateDto,
          updatedBy: userId,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_CLINIC_CONFIG',
          entity: 'ClinicConfig',
          entityId: updated.id.toString(),
          newValue: updated,
        },
      });

      return updated;
    });

    return this.toResponseDto(updatedConfig);
  }

  remove(id: number) {
    return `This action removes a #${id} clinicConfig`;
  }
}
