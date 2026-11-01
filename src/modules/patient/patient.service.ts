import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PatientResponseDto } from './dto/patient-response.dto';
import { Role } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PatientService {
  constructor(private readonly prisma: PrismaService) { }

  private toPatientDto(patient: any): PatientResponseDto {
    return {
      id: patient.id,
      fullName: patient.fullName,
      phoneNumber: patient.phoneNumber,
      email: patient.email,
      birthDate: patient.birthDate,
      address: patient.address,
      photoUrl: patient.photoUrl,
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
      isActive: patient.isActive,
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
    createPatientDto: CreatePatientDto,
    doctorId: number,
    userRole: Role,
    userClinicId: number,
  ): Promise<PatientResponseDto> {
    let targetClinicId = userClinicId;

    if (userRole === 'SUPER_ADMIN') {
      if (!createPatientDto.clinicId) {
        throw new BadRequestException('SUPER_ADMIN must specify clinicId');
      }
      targetClinicId = createPatientDto.clinicId;
    }

    if (userRole === 'SUPER_ADMIN') {
      const clinic = await this.prisma.clinic.findUnique({
        where: { id: targetClinicId },
      });
      if (!clinic) {
        throw new NotFoundException('Clinic not found');
      }
    }

    // ⭐ Chequeo de duplicado: solo si coinciden nombre + teléfono
    // Permite que familiares compartan el mismo teléfono (madre con 2 hijos, hermanos, etc.)
    // Bloquea el doble registro real (misma persona cargada 2 veces).
    if (createPatientDto.phoneNumber && createPatientDto.phoneNumber.trim() !== '') {
      const normalizedFullName = createPatientDto.fullName.trim().replace(/\s+/g, ' ');
      const normalizedPhone = createPatientDto.phoneNumber.replace(/\D/g, '');

      const duplicate = await this.prisma.patient.findFirst({
        where: {
          clinicId: targetClinicId,
          fullName: {
            equals: normalizedFullName,
            mode: 'insensitive',
          },
          phoneNumber: normalizedPhone,
        },
      });

      if (duplicate) {
        throw new ConflictException({
          code: 'PATIENT_DUPLICATE',
          message: `Ya existe un paciente con el mismo nombre y teléfono: ${duplicate.fullName} (${duplicate.medicalRecordNum}). Si son dos personas distintas, agregá un segundo nombre o diferenciá el teléfono.`,
        });
      }
    }

    const medicalRecordNum = await this.generateMedicalRecordNum(targetClinicId);

    // ⭐ Normalizar campos opcionales: undefined → null para Prisma
    const phoneNumber = createPatientDto.phoneNumber?.trim() || null;
    const email = createPatientDto.email?.trim().toLowerCase() || null;
    const address = createPatientDto.address?.trim() || null;
    const dentalHistory = createPatientDto.dentalHistory?.trim() || null;
    const habits = createPatientDto.habits?.trim() || null;
    const medicalConditions = createPatientDto.medicalConditions?.trim() || null;
    const photoUrl = createPatientDto.photoUrl?.trim() || null;

    const patient = await this.prisma.$transaction(async (prisma) => {
      const newPatient = await prisma.patient.create({
        data: {
          fullName: createPatientDto.fullName.trim().replace(/\s+/g, ' '),
          phoneNumber,
          email,
          birthDate: new Date(createPatientDto.birthDate),
          address,
          photoUrl,
          dentalHistory,
          habits,
          medicalConditions,
          medicalRecordNum,
          registeredBy: doctorId,
          clinicId: targetClinicId,
          isActive: true,
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
          newValue: newPatient,
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
    userRole: Role,
  ): Promise<{ data: PatientResponseDto[]; meta: any }> {
    const { page = 1, limit = 10, search } = params;
    const skip = (page - 1) * limit;
    const where: any = { clinicId };

    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      where.isActive = true;
      where.deletedAt = null;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { medicalRecordNum: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Total de la búsqueda (para paginación) + pacientes filtrados
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

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // ⭐ Stats globales (SIN filtro de búsqueda) — alimentan las cards del frontend
    const [totalAll, totalActive, newThisMonth] = await Promise.all([
      // Total de pacientes (activos + inactivos, sin search)
      this.prisma.patient.count({
        where: { clinicId, deletedAt: null },
      }),
      // Activos (sin search)
      this.prisma.patient.count({
        where: {
          clinicId,
          isActive: true,
          deletedAt: null,
        },
      }),
      // Nuevos este mes (sin search)
      this.prisma.patient.count({
        where: {
          clinicId,
          isActive: true,
          deletedAt: null,
          createdAt: { gte: startOfMonth },
        },
      }),
    ]);

    return {
      data: patients.map((patient) => this.toPatientDto(patient)),
      meta: {
        // `total` = total de la búsqueda filtrada (lo usa la paginación)
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        stats: {
          totalAll,       // ⭐ Total global sin filtro (para las cards)
          totalActive,
          newThisMonth,
        },
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
            name: true,
            specialty: true,
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
                name: true,
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

    if (userRole !== 'ADMIN' && userRole !== 'DOCTOR') {
      throw new ForbiddenException('No tienes permiso para eliminar este paciente');
    }

    const deletedPatient = await this.prisma.$transaction(async (prisma) => {
      const patient = await prisma.patient.update({
        where: { id },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
        include: {
          doctor: {
            select: { id: true, name: true },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'DELETE_PATIENT',
          entity: 'Patient',
          entityId: id.toString(),
          oldValue: { isActive: true, deletedAt: null },
          newValue: patient,
          clinicId,
        },
      });

      return patient;
    });

    return { message: 'Paciente eliminado exitosamente' };
  }

  async restore(id: number, userId: number, clinicId: number): Promise<{ message: string }> {
    const patient = await this.prisma.patient.findFirst({
      where: { id, clinicId },
    });

    if (!patient) {
      throw new NotFoundException(`Paciente con ID ${id} no encontrado`);
    }

    if (patient.isActive) {
      throw new BadRequestException('El paciente ya está activo');
    }

    const restoredPatient = await this.prisma.$transaction(async (prisma) => {
      const restored = await prisma.patient.update({
        where: { id },
        data: {
          isActive: true,
          deletedAt: null,
        },
        include: {
          doctor: {
            select: { id: true, name: true },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'RESTORE_PATIENT',
          entity: 'Patient',
          entityId: id.toString(),
          oldValue: { isActive: false, deletedAt: patient.deletedAt },
          newValue: restored,
          clinicId,
        },
      });

      return restored;
    });

    return { message: 'Paciente restaurado exitosamente' };
  }

  async findByMedicalRecordNum(medicalRecordNum: string): Promise<PatientResponseDto> {
    const patient = await this.prisma.patient.findUnique({
      where: { medicalRecordNum },
      include: {
        doctor: {
          select: { id: true, name: true, specialty: true },
        },
        clinicalHistory: true,
      },
    });

    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }
    return this.toPatientDto(patient);
  }

  async deletePhoto(patientId: number, clinicId: number): Promise<{ message: string }> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, clinicId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${patientId} not found`);
    }

    if (!patient.photoUrl) {
      return { message: 'No photo to delete' };
    }

    try {
      const fileName = patient.photoUrl.split('/').pop();
      if (fileName) {
        const filePath = path.join(process.cwd(), 'uploads/patients', patientId.toString(), 'photos', fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.error('Error al eliminar archivo físico:', error);
    }

    await this.prisma.patient.update({
      where: { id: patientId },
      data: { photoUrl: null },
    });

    return { message: 'Photo deleted successfully' };
  }
}