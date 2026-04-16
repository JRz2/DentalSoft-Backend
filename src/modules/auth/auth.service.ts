import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  private async comparePasswords(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  private generateToken(userId: number, email: string, role: Role, clinicId?: number | null): string {
    const payload = { sub: userId, email, role, clinicId };
    return this.jwtService.sign(payload);
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await this.hashPassword(registerDto.password);

    const user = await this.prisma.user.create({
        data: {
            name: registerDto.name,
            email: registerDto.email,
            password: hashedPassword,
            role: registerDto.role || Role.DOCTOR,
            specialty: registerDto.specialty,
            licenseNumber: registerDto.licenseNumber,
            phoneNumber: registerDto.phoneNumber,
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
            clinicId: true,
        },
    });

    const token = this.generateToken(user.id, user.email, user.role, user.clinicId);

    return {
      access_token: token,
      user,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: {
        clinic: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.comparePasswords(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is disabled');
    }

    const token = this.generateToken(user.id, user.email, user.role, user.clinicId);

    await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });

    return {
        access_token: token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            specialty: user.specialty,
            clinicId: user.clinicId,
            clinicName: user.clinic?.name ,
        },
    };
  }
}