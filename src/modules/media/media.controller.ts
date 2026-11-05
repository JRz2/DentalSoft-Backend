import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ParseIntPipe, UploadedFile, UseInterceptors, BadRequestException, StreamableFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
import { join } from 'path';
import * as path from 'path';
import { MediaService } from './media.service';
import { CreateMediaDto, CreateMediaFromB2Dto } from './dto/create-media.dto'; // 👈 Importamos el nuevo DTO
import { UpdateMediaDto } from './dto/update-media.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { mediaStorage, mediaFileFilter } from './media.interceptor';

@ApiTags('Media')
@ApiBearerAuth()
@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) { }

  @Post()
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Guardar metadatos de un archivo subido a B2' })
  async createFromB2(
    @Body() createMediaDto: CreateMediaFromB2Dto,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.mediaService.createFromB2(createMediaDto, user.clinicId, user.id);
  }

  @Post('upload')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Subir un archivo (Modo Local)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        treatmentId: { type: 'number' },
        sessionId: { type: 'number' },
        mediaType: { type: 'string' },
        category: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: mediaStorage,
      fileFilter: mediaFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() createMediaDto: CreateMediaDto,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    if (!file) throw new BadRequestException('No se ha subido ningún archivo');
    return this.mediaService.create(file, createMediaDto, user.clinicId, user.id);
  }

  @Get('treatment/:treatmentId')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  async findAllByTreatment(@Param('treatmentId', ParseIntPipe) treatmentId: number, @CurrentUser() user: any) {
    return this.mediaService.findAllByTreatment(treatmentId, user.clinicId);
  }

  @Get('session/:sessionId')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  async findAllBySession(@Param('sessionId', ParseIntPipe) sessionId: number, @CurrentUser() user: any) {
    return this.mediaService.findAllBySession(sessionId, user.clinicId);
  }

  @Get(':id')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.mediaService.findOne(id, user.clinicId);
  }

  @Get(':id/download')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  async downloadFile(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any): Promise<StreamableFile> {
    const media = await this.mediaService.findOne(id, user.clinicId);
    const filePath = join(process.cwd(), 'uploads/media', path.basename(media.filePath));
    const file = createReadStream(filePath);
    return new StreamableFile(file, { type: media.mimeType, disposition: `attachment; filename="${media.fileName}"` });
  }

  @Patch(':id')
  @Roles('ADMIN', 'DOCTOR')
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateMediaDto: UpdateMediaDto, @CurrentUser() user: any) {
    return this.mediaService.update(id, updateMediaDto, user.clinicId, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'DOCTOR')
  async delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.mediaService.delete(id, user.clinicId, user.id);
  }
}