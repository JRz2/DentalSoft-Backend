import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, } from '@nestjs/common';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PatientResponseDto } from './dto/patient-response.dto';
import { Role } from '@prisma/client';

@Injectable()
export class PatientService {
  constructor(private readonly prisma: PrismaService) { }

  //converscion de los DTo
  private toPatientDto(patient: any): PatientResponseDto {
    return {
      id: patient.id,
      fullName: patient.fullName,
      phoneNumber: patient.phoneNumber,
      email: patient.email,
      birthDate: patient.birthDate,
      address: patient.address,
      dentalHistory: patient.dentalHistory,
      habits: patient.habits,
      medicalConditions: patient.medicalConditions,
      medicalRecordNum: patient.medicalRecordNum,
      registeredBy: patient.registeredBy,
      doctor: patient.doctor ? {
        id: patient.doctor.id,
        name: patient.doctor.name,
        specialty: patient.doctor.specialty,
      } : undefined,
      deletedAt: patient.deletedAt,
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt,
    };
  }

  private async generateMedicalRecordNum(clinicId: number): Promise<string> {
    const lastPatient = await this.prisma.patient.findFirst({
      where: { clinicId: clinicId },
      orderBy: { createdAt: 'desc' },
    });

    const nextNumber = (lastPatient?.id || 0) + 1;
    const year = new Date().getFullYear();
    return `P-${year}-${clinicId}-${nextNumber.toString().padStart(5, '0')}`;
  }

  async create(
    createPatientDto: CreatePatientDto, doctorId: number, userRole: Role, userClinicId: number): Promise<PatientResponseDto> {

    let targetClinicId = userClinicId;
    if (userRole === 'SUPER_ADMIN') {
      if (!createPatientDto.clinicId) {
        throw new BadRequestException('SUPER_ADMIN must specify clinicId');
      }
      targetClinicId = createPatientDto.clinicId;
    } else {
      targetClinicId = userClinicId;
    }

    if (userRole === 'SUPER_ADMIN') {
      const clinic = await this.prisma.clinic.findUnique({
        where: { id: targetClinicId },
      });
      if (!clinic) {
        throw new NotFoundException('Clinic not found');
      }
    }

    const existingPatient = await this.prisma.patient.findFirst({
      where: {
        phoneNumber: createPatientDto.phoneNumber,
        clinicId: targetClinicId,
      },
    });

    if (existingPatient) {
      throw new ConflictException(
        'Ya existe un paciente con este número de teléfono',
      );
    }

    const medicalRecordNum = await this.generateMedicalRecordNum(targetClinicId);

    const patient = await this.prisma.$transaction(async (prisma) => {
      const newPatient = await prisma.patient.create({
        data: {
          ...createPatientDto,
          birthDate: new Date(createPatientDto.birthDate),
          medicalRecordNum,
          registeredBy: doctorId,
          clinicId: targetClinicId,
        },
        include: {
          doctor: {
            select: { id: true, name: true },
          },
        },
      });

      await prisma.clinicalHistory.create({
        data: {
          patientId: newPatient.id,
          clinicId: targetClinicId,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: doctorId,
          action: 'CREATE_PATIENT',
          entity: 'Patient',
          entityId: newPatient.id.toString(),
          newValue: new Date(),
          clinicId: targetClinicId,
        },
      });
      return newPatient;
    });

    return this.toPatientDto(patient);
  }

  async findAll(
    clinicId: number,
    params: {
      page?: number;
      limit?: number;
      search?: string;
    },
    userRole: Role,): Promise<{ data: PatientResponseDto[]; meta: any }> {
    const { page = 1, limit = 10, search } = params;
    const skip = (page - 1) * limit;

    let where: any = { clinicId };

    if (userRole !== 'ADMIN') {
      where.deletedAt = null;
    }

    if (search) {
      where = {
        clinicId,
        OR: [
          { fullName: { contains: search, mode: 'insensitive' as const } },
          { phoneNumber: { contains: search } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      };
    }
    const [patients, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          doctor: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.patient.count({ where }),
    ]);

    return {
      data: patients.map((patient) => this.toPatientDto(patient)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

  }

  async findOne(id: number): Promise<PatientResponseDto> {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        doctor: {
          select: {
            id: true,
            name: true
          },
        },
        clinicalHistory: true,
        appointments: {
          take: 5,
          orderBy: { appointmentDate: 'desc' },
          include: {
            doctor: {
              select: {
                id: true,
                name: true
              },
            },
          },
        },
      },
    });

    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');

    }
    return this.toPatientDto(patient);
  }

  async update(
    id: number,
    updatePatientDto: UpdatePatientDto,
    userId: number,
    userRole: Role,
    clinicId: number,
  ): Promise<PatientResponseDto> {
    await this.findOne(id);

    if (userRole !== 'ADMIN') {
      const patient = await this.prisma.patient.findUnique({
        where: { id },
        select: { registeredBy: true },
      });

      if (patient?.registeredBy !== userId) {
        throw new ForbiddenException('No tienes permiso para actualizar este paciente');
      }
    }

    const formattedData: any = { ...updatePatientDto };
    if (formattedData.birthDate) {
      formattedData.birthDate = new Date(formattedData.birthDate);
    }

    Object.keys(formattedData).forEach(key => {
      if (formattedData[key] === '' || formattedData[key] === null) {
        delete formattedData[key];
      }
    });

    const updatedPatient = await this.prisma.$transaction(async (prisma) => {
      const patient = await prisma.patient.update({
        where: { id },
        data: formattedData,
        include: {
          doctor: {
            select: { id: true, name: true },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_PATIENT',
          entity: 'Patient',
          entityId: id.toString(),
          newValue: patient,
          clinicId,
        },
      });

      return patient;
    });

    return this.toPatientDto(updatedPatient);
  }

  async remove(id: number, userId: number, userRole: Role, clinicId: number): Promise<{ message: string }> {
    await this.findOne(id);

    if (userRole !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para eliminar este paciente');
    }

    const deletedPatient = await this.prisma.patient.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE_PATIENT',
        entity: 'Patient',
        entityId: id.toString(),
        newValue: deletedPatient,
        clinicId,
      },
    });

    return { message: 'Paciente eliminado exitosamente' };
  }

  async findByMedicalRecordNum(medicalRecordNum: string): Promise<PatientResponseDto> {
    const patient = await this.prisma.patient.findUnique({
      where: { medicalRecordNum },
      include: {
        doctor: {
          select: { id: true, name: true },
        },
        clinicalHistory: true,
      },
    });

    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }
    return this.toPatientDto(patient);
  }

}