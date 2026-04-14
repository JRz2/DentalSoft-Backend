import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, MinLength, IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
    @ApiProperty({ example: 'John Doe'})
    @IsString()
    name: string; 

    @ApiProperty({ example: 'doctor@clinica.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'password123' })
    @IsString()
    @MinLength(6)
    password: string;

    @ApiPropertyOptional({ example: 'Odontología General' })
    @IsString()
    @IsOptional()
    specialty?: string;

    @ApiPropertyOptional({ example: '12345' })
    @IsString()
    @IsOptional()
    licenseNumber?: string;

    @ApiPropertyOptional({ example: '+573001234567' })
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiPropertyOptional({ enum: Role, default: Role.DOCTOR })
    @IsEnum(Role)
    @IsOptional()
    role?: Role;
}
