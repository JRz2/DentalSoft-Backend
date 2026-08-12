import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import path from 'path';
import * as fs from 'fs';
@Injectable()
export class ClinicService {
  constructor(private readonly prisma: PrismaService) { }

  private async moveTempImage(tempUrl: string, clinicId: number, type: 'logo' | 'favicon'): Promise<string> {
    if (!tempUrl || !tempUrl.includes('/temp/')) {
      return tempUrl; // No es temporal o no hay URL
    }

    // Extraer la ruta relativa del archivo
    // Ejemplo: /uploads/temp/users/3/648e9f91-9d8f-45ae-ba2e-04959fab32da.png
    const relativePath = tempUrl.replace('/uploads/', '');
    const tempFilePath = path.join(process.cwd(), 'uploads', relativePath);

    // Verificar si el archivo existe
    if (!fs.existsSync(tempFilePath)) {
      return tempUrl;
    }

    // Crear carpeta destino
    const destFolder = `uploads/clinics/${clinicId}/${type}s`;
    const destPath = path.join(process.cwd(), destFolder);

    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }

    // Generar nombre único
    const fileName = path.basename(tempFilePath);
    const finalFilePath = path.join(destPath, fileName);

    // Mover archivo
    fs.renameSync(tempFilePath, finalFilePath);

    // Retornar nueva URL
    return `/uploads/clinics/${clinicId}/${type}s/${fileName}`;
  }

  async create(createClinicDto: CreateClinicDto) {
    // Primero crear la clínica sin imágenes temporales
    const { logoUrl, faviconUrl, ...rest } = createClinicDto;

    const clinic = await this.prisma.clinic.create({
      data: rest,
    });

    // Ahora mover las imágenes temporales si existen
    let finalLogoUrl = logoUrl;
    let finalFaviconUrl = faviconUrl;

    if (logoUrl && logoUrl.includes('/temp/')) {
      finalLogoUrl = await this.moveTempImage(logoUrl, clinic.id, 'logo');
    }

    if (faviconUrl && faviconUrl.includes('/temp/')) {
      finalFaviconUrl = await this.moveTempImage(faviconUrl, clinic.id, 'favicon');
    }

    // Actualizar la clínica con las URLs finales
    if (finalLogoUrl !== logoUrl || finalFaviconUrl !== faviconUrl) {
      await this.prisma.clinic.update({
        where: { id: clinic.id },
        data: {
          logoUrl: finalLogoUrl,
          faviconUrl: finalFaviconUrl,
        },
      });
    }

    return this.prisma.clinic.findUnique({
      where: { id: clinic.id },
    });
  }

  async update(id: number, updateClinicDto: UpdateClinicDto) {
    const { logoUrl, faviconUrl, ...rest } = updateClinicDto;

    let finalLogoUrl = logoUrl;
    let finalFaviconUrl = faviconUrl;

    // Mover imágenes temporales si existen
    if (logoUrl && logoUrl.includes('/temp/')) {
      finalLogoUrl = await this.moveTempImage(logoUrl, id, 'logo');
    }

    if (faviconUrl && faviconUrl.includes('/temp/')) {
      finalFaviconUrl = await this.moveTempImage(faviconUrl, id, 'favicon');
    }

    return this.prisma.clinic.update({
      where: { id },
      data: {
        ...rest,
        logoUrl: finalLogoUrl,
        faviconUrl: finalFaviconUrl,
      },
    });
  }

  private generateSubdomain(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 50);
  }

  async findAll() {
    const clinics = await this.prisma.clinic.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        subdomain: true,
        phone: true,
        email: true,
        address: true,
        logoUrl: true,
        faviconUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return clinics;
  }

  async findOne(id: number) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        subdomain: true,
        phone: true,
        email: true,
        address: true,
        logoUrl: true,
        faviconUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return clinic;
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.clinic.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }

  async reactivate(id: number) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id },
    });

    if (!clinic) {
      throw new NotFoundException(`Clinic with ID ${id} not found`);
    }

    return this.prisma.clinic.update({
      where: { id },
      data: {
        isActive: true,
        updatedAt: new Date(),
      },
    });
  }

  async hardDelete(id: number) {
    const clinic = await this.findOne(id);

    return this.prisma.clinic.delete({
      where: { id },
    });
  }
}
