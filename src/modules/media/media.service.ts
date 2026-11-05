import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMediaDto, CreateMediaFromB2Dto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { MediaResponseDto } from './dto/media-response.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) { }

  private toResponseDto(media: any): MediaResponseDto {
    return {
      id: media.id,
      clinicId: media.clinicId,
      treatmentId: media.treatmentId,
      sessionId: media.sessionId,
      fileName: media.fileName,
      filePath: media.filePath,
      fileSize: media.fileSize,
      mimeType: media.mimeType,
      mediaType: media.mediaType,
      category: media.category,
      title: media.title,
      description: media.description,
      uploadedBy: media.uploader?.name,
      uploadedAt: media.uploadedAt,
      updatedAt: media.updatedAt,
    };
  }

  async createFromB2(
    createDto: CreateMediaFromB2Dto,
    clinicId: number,
    userId: number,
  ): Promise<MediaResponseDto> {
    return this.createMediaRecord(
      {
        treatmentId: createDto.treatmentId,
        sessionId: createDto.sessionId,
        mediaType: createDto.mediaType,
        category: createDto.category,
        title: createDto.title,
        description: createDto.description,
        filePath: createDto.filePath,
        fileName: createDto.fileName,
        fileSize: createDto.fileSize,
        mimeType: createDto.mimeType,
      },
      clinicId,
      userId,
    );
  }

  async create(
    file: Express.Multer.File,
    createDto: CreateMediaDto,
    clinicId: number,
    userId: number,
  ): Promise<MediaResponseDto> {
    return this.createMediaRecord(
      {
        treatmentId: createDto.treatmentId,
        sessionId: createDto.sessionId,
        mediaType: createDto.mediaType,
        category: createDto.category,
        title: createDto.title,
        description: createDto.description,
        filePath: `/uploads/media/${file.filename}`,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
      clinicId,
      userId,
    );
  }

  private async createMediaRecord(
    data: {
      treatmentId: number;
      sessionId?: number;
      mediaType: string;
      category?: string;
      title?: string;
      description?: string;
      filePath: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
    },
    clinicId: number,
    userId: number,
  ): Promise<MediaResponseDto> {
    // 1. Validar tratamiento
    const treatment = await this.prisma.treatment.findFirst({
      where: { id: data.treatmentId, clinicId },
    });
    if (!treatment) throw new NotFoundException(`Treatment with ID ${data.treatmentId} not found`);

    // 2. Validar sesión si aplica
    if (data.sessionId) {
      const session = await this.prisma.treatmentSession.findFirst({
        where: { id: data.sessionId, treatmentId: data.treatmentId, clinicId },
      });
      if (!session) throw new NotFoundException(`Session with ID ${data.sessionId} not found`);
    }

    // 3. Guardar en base de datos
    const media = await this.prisma.media.create({
      data: {
        clinicId,
        treatmentId: data.treatmentId,
        sessionId: data.sessionId || null,
        fileName: data.fileName,
        filePath: data.filePath,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        mediaType: data.mediaType as any,
        category: data.category ? (data.category as any) : null,
        title: data.title || null,
        description: data.description || null,
        uploadedBy: userId,
      },
      include: { uploader: { select: { name: true } } },
    });

    // 4. Auditoría
    await this.prisma.auditLog.create({
      data: {
        clinicId,
        userId,
        action: 'UPLOAD_MEDIA',
        entity: 'Media',
        entityId: media.id.toString(),
        newValue: { media },
        createdAt: new Date(),
      },
    });

    return this.toResponseDto(media);
  }

  async findAllByTreatment(treatmentId: number, clinicId: number): Promise<MediaResponseDto[]> {
    const media = await this.prisma.media.findMany({
      where: { treatmentId, clinicId, deletedAt: null },
      include: { uploader: { select: { name: true } } },
      orderBy: { uploadedAt: 'desc' },
    });
    return media.map(m => this.toResponseDto(m));
  }

  async findAllBySession(sessionId: number, clinicId: number): Promise<MediaResponseDto[]> {
    const media = await this.prisma.media.findMany({
      where: { sessionId, clinicId, deletedAt: null },
      include: { uploader: { select: { name: true } } },
      orderBy: { uploadedAt: 'desc' },
    });
    return media.map(m => this.toResponseDto(m));
  }

  async findOne(id: number, clinicId: number): Promise<MediaResponseDto> {
    const media = await this.prisma.media.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: { uploader: { select: { name: true } } },
    });
    if (!media) throw new NotFoundException(`Media with ID ${id} not found`);
    return this.toResponseDto(media);
  }

  async update(id: number, updateDto: UpdateMediaDto, clinicId: number, userId: number): Promise<MediaResponseDto> {
    const existingMedia = await this.prisma.media.findFirst({ where: { id, clinicId, deletedAt: null } });
    if (!existingMedia) throw new NotFoundException(`Media with ID ${id} not found`);

    const updatedMedia = await this.prisma.media.update({
      where: { id },
      data: {
        mediaType: updateDto.mediaType as any,
        category: updateDto.category as any,
        title: updateDto.title,
        description: updateDto.description,
      },
      include: { uploader: { select: { name: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        clinicId,
        userId,
        action: 'UPDATE_MEDIA',
        entity: 'Media',
        entityId: id.toString(),
        oldValue: existingMedia,
        newValue: updatedMedia,
        createdAt: new Date(),
      },
    });

    return this.toResponseDto(updatedMedia);
  }

  async delete(id: number, clinicId: number, userId: number): Promise<{ message: string }> {
    const media = await this.prisma.media.findFirst({ where: { id, clinicId, deletedAt: null } });
    if (!media) throw new NotFoundException(`Media with ID ${id} not found`);

    await this.prisma.media.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.prisma.auditLog.create({
      data: {
        clinicId,
        userId,
        action: 'DELETE_MEDIA',
        entity: 'Media',
        entityId: id.toString(),
        oldValue: media,
        createdAt: new Date(),
      },
    });

    try {
      if (media.filePath.startsWith('/uploads/media/')) {
        const filePath = path.join(process.cwd(), 'uploads/media', path.basename(media.filePath));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Error al eliminar archivo:', error);
    }

    return { message: 'Media deleted successfully' };
  }

  async getFilePath(id: number, clinicId: number): Promise<string> {
    const media = await this.prisma.media.findFirst({ where: { id, clinicId, deletedAt: null } });
    if (!media) throw new NotFoundException(`Media with ID ${id} not found`);
    return path.join(process.cwd(), 'uploads/media', path.basename(media.filePath));
  }
}