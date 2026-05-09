import { Controller, Post, Put, Delete, Param, UseInterceptors, UploadedFile, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Multer } from 'multer';

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadController {
    constructor(private readonly uploadService: UploadService) { }

    @Post('logo')
    @Roles('ADMIN', 'SUPER_ADMIN')
    @UseInterceptors(FileInterceptor('file'))
    async uploadLogo(
        @UploadedFile() file: Express.Multer.File,
        @CurrentUser() user: { id: number; role: string; clinicId: number },
        @Body('clinicId') clinicIdParam?: string,
    ) {
        let clinicId: number;

        if (user.role === 'SUPER_ADMIN') {
            if (!clinicIdParam) {
                throw new BadRequestException('SUPER_ADMIN debe proporcionar clinicId en el body');
            }
            clinicId = parseInt(clinicIdParam);
        } else {
            clinicId = user.clinicId;
        }

        const folder = `clinics/${clinicId}/logos`;
        const fileUrl = await this.uploadService.saveFile(file, folder);

        return { fileUrl, clinicId };
    }

    @Post('odontogram/:patientId')
    @Roles('DOCTOR', 'ADMIN')
    @UseInterceptors(FileInterceptor('file'))
    async uploadOdontogram(
        @UploadedFile() file: Express.Multer.File,
        @Param('patientId') patientId: string,
    ) {
        const folder = `patients/${patientId}/odontogram`;
        const fileUrl = await this.uploadService.saveFile(file, folder);
        return { fileUrl, patientId };
    }

    @Delete(':fileUrl')
    @Roles('ADMIN', 'SUPER_ADMIN')
    async deleteFile(@Param('fileUrl') fileUrl: string) {
        await this.uploadService.deleteFile(decodeURIComponent(fileUrl));
        return { message: 'File deleted successfully' };
    }
}