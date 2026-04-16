import { Controller, Get, Put, Body, Query, UseGuards, BadRequestException, Param, ParseIntPipe, UnauthorizedException } from '@nestjs/common';
import { ClinicConfigService } from './clinic-config.service';
import { UpdateClinicConfigDto } from './dto/update-clinic-config.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('clinic-config')
export class ClinicConfigController {
  constructor(private readonly clinicConfigService: ClinicConfigService) { }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'RECEPTIONIST')
  async getConfig(
    @CurrentUser() user: { id: number; role: string; clinicId?: number | null },
    @Query('clinicId') clinicIdParam?: string,
  ) {
    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    let targetClinicId: number;

    if (user.role === 'SUPER_ADMIN') {
      if (!clinicIdParam) {
        throw new BadRequestException('SUPER_ADMIN debe proporcionar clinicId');
      }
      targetClinicId = parseInt(clinicIdParam);
    } else {
      if (!user.clinicId) {
        throw new BadRequestException('Usuario no asociado a ninguna clínica');
      }
      targetClinicId = user.clinicId;
    }

    return this.clinicConfigService.getConfig(targetClinicId);
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  async updateConfig(
    @Body() updateDto: UpdateClinicConfigDto,
    @CurrentUser() user: { id: number; role: string; clinicId?: number | null },
    @Query('clinicId') clinicIdParam?: string,
  ) {
    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    let targetClinicId: number;

    if (user.role === 'SUPER_ADMIN') {
      if (!clinicIdParam) {
        throw new BadRequestException('SUPER_ADMIN debe proporcionar clinicId');
      }
      targetClinicId = parseInt(clinicIdParam);
    } else {
      if (!user.clinicId) {
        throw new BadRequestException('Usuario no asociado a ninguna clínica');
      }
      targetClinicId = user.clinicId;
    }

    return this.clinicConfigService.updateConfig(updateDto, user.id, targetClinicId);
  }
}