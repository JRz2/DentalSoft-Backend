import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Put } from '@nestjs/common';
import { ClinicConfigService } from './clinic-config.service';
import { CreateClinicConfigDto } from './dto/create-clinic-config.dto';
import { UpdateClinicConfigDto } from './dto/update-clinic-config.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('clinic-config')
export class ClinicConfigController {
  constructor(private readonly clinicConfigService: ClinicConfigService) { }

  @Get()
  async getConfig() {
    return this.clinicConfigService.getConfig();
  }

  @Put()
  @Roles('ADMIN')
  async updateConfig(
    @Body() updateDto: UpdateClinicConfigDto,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.clinicConfigService.updateConfig(updateDto, user.id);
  }

  @Post()
  create(@Body() createClinicConfigDto: CreateClinicConfigDto) {
    return this.clinicConfigService.create(createClinicConfigDto);
  }

  @Get()
  findAll() {
    return this.clinicConfigService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clinicConfigService.findOne(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clinicConfigService.remove(+id);
  }
}
