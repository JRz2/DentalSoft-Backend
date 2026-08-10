import { Controller, Get, Post, Body, Patch, Param, Delete, BadRequestException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Multer } from 'multer';
import { PrismaService } from '../../prisma/prisma.service';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from 'src/common/uploads/upload.service';
@UseGuards(AuthGuard('jwt'), RolesGuard)

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly uploadService: UploadService,
    private readonly prisma: PrismaService) { }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: { id: number }) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: { id: number },
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(user.id, updateUserDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: { id: number },
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user.id, changePasswordDto);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@Body() createUserDto: CreateUserDto) {
    console.log('📝 Datos recibidos para crear usuario:', JSON.stringify(createUserDto, null, 2));
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }

  @Post(':userId/photo')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async uploadUserPhotoById(
    @UploadedFile() file: Express.Multer.File,
    @Param('userId') userId: string,
    @CurrentUser() user: { id: number; role: string; clinicId: number },
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }

    // Verificar que el usuario existe
    const userExists = await this.prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!userExists) {
      throw new BadRequestException(`User with ID ${userId} not found`);
    }

    const folder = `users/${userId}/photos`;
    const fileUrl = await this.uploadService.saveFile(file, folder);

    await this.prisma.user.update({
      where: { id: parseInt(userId) },
      data: { photoUrl: fileUrl },
    });

    return {
      fileUrl,
      userId,
      message: 'Foto de usuario actualizada correctamente'
    };
  }
}
