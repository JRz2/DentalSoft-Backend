import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';

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

    const hashedPassword = await this.hashPassword(createUserDto.password);

    const user = await this.prisma.user.create({
      data: {
        name: createUserDto.name,
        email: createUserDto.email,
        password: hashedPassword,
        role: createUserDto.role,
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
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        specialty: true,
        licenseNumber: true,
        phoneNumber: true,
        isActive: true,
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

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
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

  async updateProfile(userId: number, updateUserDto: UpdateUserDto) {
    const { role, isActive, password, ...allowedFields } = updateUserDto;
    return this.update(userId, allowedFields);
  }

  async getProfile(userId: number) {
    return this.findOne(userId);
  }

}


