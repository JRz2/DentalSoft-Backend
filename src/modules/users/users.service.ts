import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminChangePasswordDto } from './dto/admin-change-password.dto';
import * as bycrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {

  constructor(private readonly prisma: PrismaService) { }

  private async hashPassword(password: string): Promise<string> {
    return bycrypt.hash(password, 10);
  }

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const clinicId = Number(createUserDto.clinicId);

    if (isNaN(clinicId) || clinicId <= 0) {
      throw new BadRequestException('Invalid clinicId');
    }

    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
    });

    if (!clinic) {
      throw new BadRequestException(`Clinic with ID ${clinicId} not found`);
    }
    const hashedPassword = await this.hashPassword(createUserDto.password);

    const user = await this.prisma.user.create({
      data: {
        name: createUserDto.name,
        email: createUserDto.email,
        password: hashedPassword,
        role: createUserDto.role,
        clinicId: clinicId,
        photoUrl: createUserDto.photoUrl,
        specialty: createUserDto.specialty,
        licenseNumber: createUserDto.licenseNumber,
        phoneNumber: createUserDto.phoneNumber,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        photoUrl: true,
        specialty: true,
        licenseNumber: true,
        phoneNumber: true,
        isActive: true,
        createdAt: true,
      },
    });
    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        specialty: true,
        licenseNumber: true,
        phoneNumber: true,
        photoUrl: true,
        isActive: true,
        clinic: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        specialty: true,
        licenseNumber: true,
        phoneNumber: true,
        photoUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new ConflictException('User not found');
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    await this.findOne(id);

    let data: any = { ...updateUserDto };
    if (updateUserDto.password) {
      data.password = await this.hashPassword(updateUserDto.password);
    }

    if (data.photoUrl == '') {
      delete data.photoUrl;
    }

    if (data.licenseNumber === '') {
      data.licenseNumber = null;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        photoUrl: true,
        specialty: true,
        licenseNumber: true,
        phoneNumber: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        deletedAt: true,
      }
    });
  }

  async reactivate(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      }
    });
  }

  async hardDelete(id: number) {
    await this.findOne(id);

    return this.prisma.user.delete({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
      }
    });
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bycrypt.compare(dto.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bycrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }

  async changePasswordByAdmin(
    userId: number,
    dto: AdminChangePasswordDto,
    currentUser: { id: number, role: string, clinicId: number },
  ) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        clinicId: true,
        role: true,
        name: true,
        email: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (currentUser.role === 'SUPER_ADMIN') {
    } else if (currentUser.role === 'ADMIN') {
      if (targetUser.clinicId !== currentUser.clinicId) {
        throw new ForbiddenException(
          'No tienes permiso para cambiar la contraseña de este usuario (pertenece a otra clínica)'
        );
      }
    } else {
      throw new ForbiddenException('No tienes permiso para cambiar contraseñas de otros usuarios');
    }

    const hashedPassword = await this.hashPassword(dto.newPassword);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        clinicId: true,
        updatedAt: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: currentUser.id,
        action: 'ADMIN_CHANGE_PASSWORD',
        entity: 'User',
        entityId: userId.toString(),
        newValue: {
          changedBy: currentUser.id,
          changedByRole: currentUser.role,
          targetUser: targetUser.email,
        },
        clinicId: currentUser.clinicId,
      },
    });

    return {
      message: `Contraseña de ${updatedUser.name} actualizada correctamente`,
      user: updatedUser,
    };
  }
  async updateProfile(userId: number, updateUserDto: UpdateUserDto) {
    const { role, isActive, password, ...allowedFields } = updateUserDto;
    return this.update(userId, allowedFields);
  }

  async getProfile(userId: number) {
    return this.findOne(userId);
  }

}


