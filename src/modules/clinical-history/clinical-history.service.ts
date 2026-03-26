import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateClinicalHistoryDto } from './dto/create-clinical-history.dto';
import { UpdateClinicalHistoryDto } from './dto/update-clinical-history.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClinicalHistoryResponseDto } from './dto/clinical-history-response.dto';

@Injectable()
export class ClinicalHistoryService {
  constructor (private readonly prisma: PrismaService) {}

  private toResponseDto(history: any): ClinicalHistoryResponseDto {
    return{
      id: history.id,
      patientId: history.patientId,
      odontogram: history.odontogram,
      medicalHistory: history.medicalHistory,
      allergies: history.allergies,
      observations: history.observations,
      createdAt: history.createdAt,
      updatedAt: history.updatedAt
    };
  }

  async findByPatientId(patientId: number): Promise<ClinicalHistoryResponseDto> {
    const history = await this.prisma.clinicalHistory.findUnique({
      where: { patientId },
      include: {
        patient: {
          select: {
            id: true,
            fullName: true,
            medicalRecordNum: true,
          },   
        }
      },
    });

    if (!history) {
      throw new NotFoundException(`No se encontró la historia clínica para el paciente con ID ${patientId}`);
    }

    return this.toResponseDto(history);
  }

  async update(
    patientId: number,
    updateDto: UpdateClinicalHistoryDto,
    userId: number,
  ): Promise<ClinicalHistoryResponseDto> {
    await this.findByPatientId(patientId);

    const updatedHistory = await this.prisma.clinicalHistory.update({
      where: { patientId },
      data: updateDto, 
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entity: 'ClinicalHistory',
        entityId: updatedHistory.id.toString(),
        newValue: updatedHistory,
      },
    });
    return this.toResponseDto(updatedHistory);
  }

  create(createClinicalHistoryDto: CreateClinicalHistoryDto) {
    return 'This action adds a new clinicalHistory';
  }

  findAll() {
    return `This action returns all clinicalHistory`;
  }

  findOne(id: number) {
    return `This action returns a #${id} clinicalHistory`;
  }

  remove(id: number) {
    return `This action removes a #${id} clinicalHistory`;
  }
}
