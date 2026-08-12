import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';

export class AdminChangePasswordDto {
    @ApiProperty({ example: 'newPassword123', description: 'Nueva contraseña del usuario' })
    @IsString()
    @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
    @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
        message: 'La contraseña debe contener al menos una letra y un número',
    })
    newPassword: string;

    @ApiProperty({ example: 'newPassword123', description: 'Confirmar nueva contraseña' })
    @IsString()
    confirmPassword: string;
}