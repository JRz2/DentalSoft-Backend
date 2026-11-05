import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private isLocal: boolean;

  constructor() {
    this.bucketName = process.env.B2_BUCKET_NAME as string;
    // EL INTERRUPTOR: Si es 'local', usamos el disco. Si no, usamos B2.
    this.isLocal = process.env.STORAGE_MODE === 'local';

    if (!this.isLocal) {
      this.s3Client = new S3Client({
        endpoint: process.env.B2_ENDPOINT,
        region: process.env.B2_REGION,
        credentials: {
          accessKeyId: process.env.B2_ACCESS_KEY_ID as string,
          secretAccessKey: process.env.B2_SECRET_ACCESS_KEY as string,
        },
        forcePathStyle: true,
      });
    }
  }

  async generateUploadUrl(folder: string, contentType: string) {
    const fileExtension = contentType.split('/')[1] || 'jpg';
    const fileName = `${folder}/${randomUUID()}.${fileExtension}`;

    if (this.isLocal) {
      // MODO LOCAL: No hay URL prefirmada. El frontend subirá a /uploads/temp
      return { uploadUrl: null, key: fileName, mode: 'local' };
    }

    // MODO B2
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        ContentType: contentType,
      });
      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });
      return { uploadUrl, key: fileName, mode: 'b2' };
    } catch (error) {
      throw new InternalServerErrorException('Error generando URL de subida');
    }
  }

  async generateDownloadUrl(key: string) {
    if (this.isLocal) {
      // MODO LOCAL: Devolvemos la ruta estática de tu backend en local
      return `http://localhost:3000/uploads/${key}`;
    }

    // MODO B2
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    } catch (error) {
      throw new InternalServerErrorException('Error generando URL de descarga');
    }
  }
}