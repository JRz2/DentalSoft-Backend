import { Injectable, NestInterceptor, ExecutionContext, CallHandler, BadRequestException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MediaInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const file = request.file;

        if (!file) {
            throw new BadRequestException('No se ha subido ningún archivo');
        }

        // Validar tipo de archivo
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new BadRequestException('Formato de archivo no permitido. Use: JPEG, PNG, WEBP, GIF o PDF');
        }

        // Validar tamaño (5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new BadRequestException('El archivo no puede superar los 5MB');
        }

        return next.handle();
    }
}

// Configuración de almacenamiento
export const mediaStorage = diskStorage({
    destination: './uploads/media',
    filename: (req, file, callback) => {
        const uniqueName = uuidv4();
        const extension = extname(file.originalname);
        callback(null, `${uniqueName}${extension}`);
    },
});

// Filtro de archivos
export const mediaFileFilter = (req: any, file: any, callback: any) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        callback(null, true);
    } else {
        callback(new BadRequestException('Formato de archivo no permitido'), false);
    }
};