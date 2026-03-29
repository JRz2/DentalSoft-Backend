import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { UpdateTreatmentDto } from './dto/update-treatment.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { TreatmentResponseDto } from './dto/treatment-response.dto';
import { Role } from '@prisma/client';


@Injectable()
export class TreatmentService {
  constructor (private readonly prisma: PrismaService) {}

  private ToResponseDto(treatment: any) {
    return {
      id: treatment.id,
      clinicalHistoryId: treatment.clinicalHistoryId,
      name: treatment.name,
      description: treatment.description,
      type: treatment.type,
      estimatedSessions: treatment.estimatedSessions,
      status: treatment.status,
      starDate: treatment.starDate,
      endDate: treatment.endDate,
      createdAt: treatment.createdAt,
      updatedAt: treatment.updatedAt,
      sessions: treatment.sessions,
    };
  }

  async create(
    createDto: CreateTreatmentDto,
    clinicalHistoryId: number,
    userId: number,
  ): Promise<TreatmentResponseDto> {
    const clinicalHistory = await this.prisma.clinicalHistory.findUnique({
      where: { id: clinicalHistoryId },
    });

    if (!clinicalHistory) {
      throw new NotFoundException(`Clinical history with ID ${clinicalHistoryId} not found`);
    }

    const treatment = await this.prisma.$transaction( async (prisma) => {
      const newTreatment = await prisma.treatment.create({
        data: {
          clinicalHistoryId,
          name: createDto.name,
          description: createDto.description,
          type: createDto.type,
          estimatedSessions: createDto.estimatedSessions,
          status: createDto.status || 'PLANNED',
        },
        include: {
          sessions: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'CREATE_TREATMENT',
          entity: 'Treatment',
          entityId: newTreatment.id.toString(),
          newValue: newTreatment,
        },
      });

      return newTreatment;  
    });
    
    return this.ToResponseDto(treatment);
  }

  async findByPatientId(patientId: number): Promise<TreatmentResponseDto[]> {
    const treatments = await this.prisma.treatment.findMany({
      where: {
        clinicalHistory: {
          patientId,
        },
      },
      include: {
        sessions: {
          orderBy: { sessionNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return treatments.map(treatment => this.ToResponseDto(treatment));
  }

  findAll() {
    return `This action returns all treatment`;
  }

  async findOne(id: number): Promise<TreatmentResponseDto> {
    const treatment = await this.prisma.treatment.findUnique({
      where: { id },
      include: {
        clinicalHistory: {
          include: {
            patient: {
              select: {
                id: true,
                fullName: true,
                medicalRecordNum: true,
              }
            }
          }
        },
        sessions: {
          orderBy: { sessionNumber: 'asc' },
          include: {
            appointment: {
              select: {
                id: true,
                appointmentDate: true,
                status: true,
              }
            }
          }
        }
      }
    });

    if (!treatment) {
      throw new NotFoundException(`Treatment with ID ${id} not found`);
    }

    return this.ToResponseDto(treatment);
  }

  async update(
    id: number, 
    updateDto: UpdateTreatmentDto,
    userId: number): Promise<TreatmentResponseDto> {
      await this.findOne(id);

      const updatedTreatment = await this.prisma.$transaction(async (primsa) => {
        const treatment = await primsa.treatment.update({
          where: {id},
          data: updateDto,
          include: { sessions: true},
        });

        await primsa.auditLog.create({
          data: {
            userId,
            action: 'UPDATE_TREATMENT',
            entity: 'treatment',
            entityId: id.toString(),
            newValue: treatment,
          },
        });

        return treatment;
      });
      
      return this.ToResponseDto(updatedTreatment);
  }

  async cancel(id: number, userId: number, userRole: Role): Promise<{message: string}>{
    await this.findOne(id);

    if(userRole !=='ADMIN' && userRole !=='DOCTOR'){
      throw new ForbiddenException('Only ADMNI or DOCTOR can cancel treatment');
    }

    const cancellTreatment = await this.prisma.$transaction(async (prisma) =>{
      const treatment = await prisma.treatment.update({
        where: {id},
        data: {status: 'CANCELLED', endDate: new Date()},
      });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CANCEL_TREATMEN',
        entity: 'treatment',
        entityId: id.toString(),
        oldValue: treatment,
      },
    });

    return treatment;
  });

  return { message: 'Treatment cancelled successfully' };
}

}
