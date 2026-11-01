import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserResponseDto {
    @ApiProperty({ example: 1 })
    id: number;

    @ApiProperty({ example: 1 })
    clinicId: number;

    @ApiProperty({ example: 'Dr. Juan Pérez' })
    name: string;

    @ApiProperty({ example: 'juan@clinica.com' })
    email: string;

    @ApiProperty({ enum: Role, example: 'DOCTOR' })
    role: Role;

    @ApiProperty({ example: 'https://example.com/photo.jpg', required: false })
    photoUrl?: string;

    @ApiProperty({ example: 'Odontología General', required: false })
    specialty?: string;

    @ApiProperty({ example: '12345', required: false })
    licenseNumber?: string;

    @ApiProperty({ example: '123456789', required: false })
    phoneNumber?: string;

    @ApiProperty({ example: true })
    isActive: boolean;

    @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
    createdAt: Date;

    @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
    updatedAt: Date;
}