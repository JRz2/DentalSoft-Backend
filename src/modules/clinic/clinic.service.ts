import { Injectable } from '@nestjs/common';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ClinicService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createClinicDto: CreateClinicDto) {

    const subdomain = createClinicDto.subdomain || this.generateSubdomain(createClinicDto.name);

    return this.prisma.clinic.create({
      data: {
        name: createClinicDto.name,
        address: createClinicDto.address,
        phone: createClinicDto.phone,
        email: createClinicDto.email,
        subdomain: subdomain,
        logoUrl: createClinicDto.logoUrl,
        faviconUrl: createClinicDto.faviconUrl,
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
    return this.prisma.clinic.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        subdomain: true,
      },
    });
  }

  findOne(id: number) {
    return `This action returns a #${id} clinic`;
  }

  update(id: number, updateClinicDto: UpdateClinicDto) {
    return `This action updates a #${id} clinic`;
  }

  remove(id: number) {
    return `This action removes a #${id} clinic`;
  }
}
