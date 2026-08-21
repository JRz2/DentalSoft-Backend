import { ApiProperty } from "@nestjs/swagger";
import { MediaType, MediaCategory } from "@prisma/client";

export class MediaResponseDto {
    @ApiProperty({ example: 1 })
    id: number;

    @ApiProperty({ example: 1 })
    clinicId: number;

    @ApiProperty({ example: 1, nullable: true })
    treatmentId?: number;

    @ApiProperty({ example: 1, nullable: true })
    sessionId?: number;

    @ApiProperty({ example: 'radiografia-molar36.jpg' })
    fileName: string;

    @ApiProperty({ example: '/uploads/media/radiografia-molar36.jpg' })
    filePath: string;

    @ApiProperty({ example: 1024576 })
    fileSize?: number;

    @ApiProperty({ example: 'image/jpeg' })
    mimeType?: string;

    @ApiProperty({ enum: MediaType, example: 'IMAGE' })
    mediaType: MediaType;

    @ApiProperty({ enum: MediaCategory, example: 'PRE_OPERATIVE' })
    category?: MediaCategory;

    @ApiProperty({ example: 'Radiografía preoperatoria' })
    title?: string;

    @ApiProperty({ example: 'Radiografía del molar 36' })
    description?: string;

    @ApiProperty({ example: 'Juan Pérez' })
    uploadedBy?: string;

    @ApiProperty({ example: '2026-08-18T10:00:00.000Z' })
    uploadedAt: Date;

    @ApiProperty({ example: '2026-08-18T10:30:00.000Z' })
    updatedAt: Date;
}