import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
import { join } from 'path';
import * as path from 'path';
import { MediaService } from './media.service';
import { CreateMediaDto } from './dto/create-media.dto';
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

  @Post('upload')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Subir un archivo para un tratamiento' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        treatmentId: { type: 'number' },
        sessionId: { type: 'number' },
        mediaType: { type: 'string', enum: ['IMAGE', 'VIDEO', 'DOCUMENT', 'XRAY', 'SCAN', 'OTHER'] },
        category: { type: 'string', enum: ['TREATMENT', 'SESSION', 'PRE_OPERATIVE', 'POST_OPERATIVE', 'INTRAOPERATIVE', 'DIAGNOSTIC', 'FOLLOW_UP'] },
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
    @CurrentUser() user: { id: number; role: string; clinicId: number }, // ✅ Usar CurrentUser
  ) {
    if (!file) {
      throw new BadRequestException('No se ha subido ningún archivo');
    }

    return this.mediaService.create(
      file,
      createMediaDto,
      user.clinicId, // ✅ Obtener clinicId del usuario
      user.id,
    );
  }

  @Get('treatment/:treatmentId')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener todos los archivos de un tratamiento' })
  async findAllByTreatment(
    @Param('treatmentId', ParseIntPipe) treatmentId: number,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.mediaService.findAllByTreatment(treatmentId, user.clinicId);
  }

  @Get('session/:sessionId')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener todos los archivos de una sesión' })
  async findAllBySession(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.mediaService.findAllBySession(sessionId, user.clinicId);
  }

  @Get(':id')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Obtener un archivo por ID' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.mediaService.findOne(id, user.clinicId);
  }

  @Get(':id/download')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiOperation({ summary: 'Descargar un archivo' })
  async downloadFile(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ): Promise<StreamableFile> {
    const media = await this.mediaService.findOne(id, user.clinicId);
    const filePath = join(process.cwd(), 'uploads/media', path.basename(media.filePath));

    const file = createReadStream(filePath);
    return new StreamableFile(file, {
      type: media.mimeType,
      disposition: `attachment; filename="${media.fileName}"`,
    });
  }

  @Patch(':id')
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Actualizar metadatos de un archivo' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMediaDto: UpdateMediaDto,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.mediaService.update(id, updateMediaDto, user.clinicId, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Eliminar un archivo' })
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    return this.mediaService.delete(id, user.clinicId, user.id);
  }
}