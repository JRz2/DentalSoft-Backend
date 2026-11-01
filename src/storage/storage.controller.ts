import { Controller, Post, Body, UseGuards, Get, Query } from '@nestjs/common';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('storage')
@UseGuards(JwtAuthGuard) // Protegemos las rutas para que solo usuarios logueados pidan URLs
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload-url')
  async getUploadUrl(@Body() body: { folder: string; contentType: string }) {
    // Ejemplo de body: { folder: 'pacientes/123', contentType: 'image/jpeg' }
    return this.storageService.generateUploadUrl(body.folder, body.contentType);
  }

  @Get('view-url')
  async getViewUrl(@Query('key') key: string) {
    // Devuelve una URL temporal para ver la imagen
    const url = await this.storageService.generateDownloadUrl(key);
    return { url };
  }
}