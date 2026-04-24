import { Injectable } from '@nestjs/common';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ClinicService {
  constructor(private readonly prisma: PrismaService) {}
  create(createClinicDto: CreateClinicDto) {
    return 'This action adds a new clinic';
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
