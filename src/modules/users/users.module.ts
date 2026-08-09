import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { UploadModule } from 'src/common/uploads/upload.module';
@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
  imports: [UploadModule],
})
export class UsersModule {}
