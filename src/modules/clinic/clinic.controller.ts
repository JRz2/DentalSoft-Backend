import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { ClinicService } from './clinic.service';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('clinic')
@UseGuards(JwtAuthGuard, RolesGuard)

export class ClinicController {
  constructor(private readonly clinicService: ClinicService) { }

  @Post()
  create(@Body() createClinicDto: CreateClinicDto) {
    return this.clinicService.create(createClinicDto);
  }

  @Get()
  findAll() {
    return this.clinicService.findAll();
  }

  @Get('me')
  @Roles('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'RECEPTIONIST')
  async getMyClinic(
    @CurrentUser() user: { id: number; role: string; clinicId?: number | null },
  ) {
    if (!user.clinicId) {
      throw new BadRequestException('Usuario no asociado a ninguna clínica');
    }
    return this.clinicService.getMyClinic(user.clinicId);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async findOne(@Param('id') id: string) {
    const clinic = await this.clinicService.findOne(+id);
    return clinic;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateClinicDto: UpdateClinicDto) {
    return this.clinicService.update(+id, updateClinicDto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  remove(@Param('id', ParseIntPipe) id: string) {
    return this.clinicService.remove(+id);
  }

  @Patch(':id/reactivate')
  @Roles('SUPER_ADMIN')
  reactivate(@Param('id', ParseIntPipe) id: number) {
    return this.clinicService.reactivate(id);
  }
}
