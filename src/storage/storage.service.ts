import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.B2_BUCKET_NAME as string;
    
    // Configuramos el cliente S3 apuntando a Backblaze B2
    this.s3Client = new S3Client({
      endpoint: process.env.B2_ENDPOINT,
      region: process.env.B2_REGION,
      credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY as string,
      },
      forcePathStyle: true, // 👈 OBLIGATORIO para Backblaze B2
    });
  }

  // 1. Genera la URL para SUBIR un archivo
  async generateUploadUrl(folder: string, contentType: string) {
    try {
      const fileExtension = contentType.split('/')[1] || 'jpg';
      const fileName = `${folder}/${randomUUID()}.${fileExtension}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        ContentType: contentType,
      });

      // URL válida por 15 minutos
      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });

      return {
        uploadUrl, // El frontend usa esta URL para el PUT
        key: fileName, // Guarda esto en tu base de datos (Prisma)
      };
    } catch (error) {
      console.error('Error generando URL de subida:', error);
      throw new InternalServerErrorException('No se pudo generar la URL de subida');
    }
  }

  // 2. Genera la URL para VER/DESCARGAR un archivo (porque el bucket es privado)
  async generateDownloadUrl(key: string) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      
      // URL válida por 1 hora (3600 segundos)
      return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    } catch (error) {
      console.error('Error generando URL de descarga:', error);
      throw new InternalServerErrorException('No se pudo generar la URL de descarga');
    }
  }
}