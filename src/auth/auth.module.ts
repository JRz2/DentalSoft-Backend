import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtStrategy } from './strategies/jwt.strategy/jwt.strategy';
import { PermissionsGuard } from './permissions/permissions.guard';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: 'supersecret',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [AuthService, JwtStrategy, PermissionsGuard],
  controllers: [AuthController],
})
export class AuthModule {}