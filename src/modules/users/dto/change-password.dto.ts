import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
    @ApiProperty({ example: 'oldPassword123' })
    @IsString()
    currentPassword: string;

    @ApiProperty({ example: 'newPassword123' })
    @IsString()
    @MinLength(6)
    @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
        message: 'Password must contain at least one letter and one number',
    })
    newPassword: string;

    @ApiProperty({ example: 'newPassword123' })
    @IsString()
    confirmPassword: string;
}