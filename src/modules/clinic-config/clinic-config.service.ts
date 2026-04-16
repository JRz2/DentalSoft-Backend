import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateClinicConfigDto } from './dto/update-clinic-config.dto';
import { ClinicConfigResponseDto } from './dto/clinic-config-response.dto';

@Injectable()
export class ClinicConfigService {
  constructor(private readonly prisma: PrismaService) { }

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
      headerImageUrl: config.headerImageUrl,
      footerText: config.footerText,
      registrationNumber: config.registrationNumber,
      licenseNumber: config.licenseNumber,
      socialMedia: config.socialMedia,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async getConfig(clinicId: number): Promise<ClinicConfigResponseDto> {
    // Buscar configuración por clinicId
    let config = await this.prisma.clinicConfig.findUnique({
      where: { clinicId },
    });

    // Si no existe, crear configuración por defecto
    if (!config) {
      // Obtener información de la clínica
      const clinic = await this.prisma.clinic.findUnique({
        where: { id: clinicId },
      });

      if (!clinic) {
        throw new NotFoundException(`Clinic with ID ${clinicId} not found`);
      }

      // Crear configuración por defecto
      config = await this.prisma.clinicConfig.create({
        data: {
          clinicId,
          businessName: clinic.name,
          commercialName: clinic.name,
          email: clinic.email || '',
          mobile: clinic.phone || '',
          address: clinic.address || '',
        },
      });
    }

    return this.toResponseDto(config);
  }

  async updateConfig(
    updateDto: UpdateClinicConfigDto,
    userId: number,
    clinicId: number,
  ): Promise<ClinicConfigResponseDto> {
    // Verificar que la configuración existe
    let config = await this.prisma.clinicConfig.findUnique({
      where: { clinicId },
    });

    if (!config) {
      // Si no existe, crearla primero
      const clinic = await this.prisma.clinic.findUnique({
        where: { id: clinicId },
      });

      if (!clinic) {
        throw new NotFoundException(`Clinic with ID ${clinicId} not found`);
      }

      config = await this.prisma.clinicConfig.create({
        data: {
          clinicId,
          businessName: clinic.name,
          commercialName: clinic.name,
          email: clinic.email || '',
          mobile: clinic.phone || '',
          address: clinic.address || '',
        },
      });
    }

    // Actualizar configuración
    const updatedConfig = await this.prisma.$transaction(async (prisma) => {
      const updated = await prisma.clinicConfig.update({
        where: { id: config.id },
        data: {
          ...updateDto,
          updatedBy: userId,
        },
      });

      // Registrar auditoría
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_CLINIC_CONFIG',
          entity: 'ClinicConfig',
          entityId: updated.id.toString(),
          newValue: updated,
          clinicId,
        },
      });

      return updated;
    });

    return this.toResponseDto(updatedConfig);
  }

  // Método adicional para obtener todas las configuraciones (solo SUPER_ADMIN)
  async getAllConfigs(): Promise<ClinicConfigResponseDto[]> {
    const configs = await this.prisma.clinicConfig.findMany({
      include: {
        clinic: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
      },
    });

    return configs.map((c) => this.toResponseDto(c));
  }

  // Método para obtener configuración por ID de clínica (con validación)
  async getConfigByClinicId(clinicId: number, userRole: string, userClinicId?: number): Promise<ClinicConfigResponseDto> {
    // Validar permisos
    if (userRole !== 'SUPER_ADMIN' && userClinicId !== clinicId) {
      throw new ForbiddenException('You do not have access to this clinic configuration');
    }

    return this.getConfig(clinicId);
  }
}