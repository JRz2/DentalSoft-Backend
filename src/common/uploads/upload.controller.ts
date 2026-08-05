import { Controller, Post, Put, Delete, Param, UseInterceptors, UploadedFile, Body, UseGuards, BadRequestException, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Multer } from 'multer';
import { PrismaService } from '../../prisma/prisma.service';
import type { Request } from 'express';
@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadController {
    constructor(
        private readonly uploadService: UploadService, 
        private readonly prisma: PrismaService
    ) { }

    // Endpoint para subida temporal (antes de crear la clínica)
    @Post('temp')
    @Roles('ADMIN', 'SUPER_ADMIN')
    @UseInterceptors(FileInterceptor('file'))
    async uploadTemp(
        @UploadedFile() file: Express.Multer.File,
        @CurrentUser() user: { id: number; role: string; clinicId: number },
    ) {
        if (!file) {
            throw new BadRequestException('No se recibió ningún archivo');
        }

        // Guardar en carpeta temporal con ID de usuario
        const folder = `temp/users/${user.id}`;
        const fileUrl = await this.uploadService.saveFile(file, folder);

        return {
            fileUrl,
            temp: true,
            message: 'Archivo subido temporalmente'
        };
    }

    // Endpoint para logo con clinicId (para edición)
    @Post('logo')
    @Roles('ADMIN', 'SUPER_ADMIN')
    @UseInterceptors(FileInterceptor('file'))
    async uploadLogo(
        @UploadedFile() file: Express.Multer.File,
        @CurrentUser() user: { id: number; role: string; clinicId: number },
        @Body('clinicId') clinicIdParam?: string,
    ) {

        if (!file) {
            throw new BadRequestException('No se recibió ningún archivo');
        }

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

    @Post('patient/:patientId/photo')
    @Roles('DOCTOR', 'ADMIN', 'RECEPTIONIST')
    @UseInterceptors(FileInterceptor('file'))
    async uploadPatientPhoto(
        @UploadedFile() file: Express.Multer.File,
        @Param('patientId') patientId: string,
        @CurrentUser() user: { id: number; role: string; clinicId: number },
        @Req() req: Request,
    ) {
  console.log('📋 Headers:', req.headers);
  console.log('📋 Content-Type:', req.headers['content-type']);
  console.log('📸 File:', file);

        if (!file) {
            throw new BadRequestException('No se recibió ningún archivo');    
        }

        const folder = `patients/${patientId}/photos`;
        const fileUrl = await this.uploadService.saveFile(file, folder);

        await this.prisma.patient.update({
            where: { id: parseInt(patientId) },
            data: { photoUrl: fileUrl },
        })

        return { fileUrl, patientId, message: 'Photo uploaded successfully' };
    }
}