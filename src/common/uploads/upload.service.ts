import { Injectable, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class UploadService {
    private readonly uploadDir = './uploads';

    constructor() {
        // Crear directorio de uploads si no existe
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    async saveFile(file: Express.Multer.File, folder: string = 'general'): Promise<string> {
        if (!file) {
            throw new BadRequestException('No file provided');
        }

        // Validar tipo de archivo
        const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (!allowedMimes.includes(file.mimetype)) {
            throw new BadRequestException('Only images (JPEG, PNG, WEBP) are allowed');
        }

        // Validar tamaño máximo (5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new BadRequestException('File too large. Max size 5MB');
        }

        // Generar nombre único
        const extension = path.extname(file.originalname);
        const filename = `${uuidv4()}${extension}`;
        const folderPath = path.join(this.uploadDir, folder);

        // Crear carpeta si no existe
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        const filePath = path.join(folderPath, filename);

        // Guardar archivo
        fs.writeFileSync(filePath, file.buffer);

        // Devolver URL accesible
        return `/uploads/${folder}/${filename}`;
    }

    async deleteFile(fileUrl: string): Promise<boolean> {
        if (!fileUrl) return false;

        const filePath = path.join('.', fileUrl);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    }

    async updateFile(oldFileUrl: string, newFile: Express.Multer.File, folder: string): Promise<string> {
        // Eliminar archivo anterior
        if (oldFileUrl) {
            await this.deleteFile(oldFileUrl);
        }
        // Guardar nuevo archivo
        return this.saveFile(newFile, folder);
    }
}