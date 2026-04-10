import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe, Put } from '@nestjs/common';
import { TreatmentSessionService } from './treatment-session.service';
import { CreateTreatmentSessionDto } from './dto/create-treatment-session.dto';
import { UpdateTreatmentSessionDto } from './dto/update-treatment-session.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('treatment-session')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TreatmentSessionController {
  constructor(private readonly treatmentSessionService: TreatmentSessionService) { }

  @Post()
  @Roles('ADMIN', 'DOCTOR')
  create(
    @Body() createTreatmentSessionDto: CreateTreatmentSessionDto,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.treatmentSessionService.create(createTreatmentSessionDto, user.id);
  }

  @Get(':id')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.treatmentSessionService.findOne(id);
  }

  @Get('treatment/:treatmentId')
  @Roles('ADMIN', 'DOCTOR', 'RECEPTIONIST')
  findByTreatment(@Param('treatmentId', ParseIntPipe) treatmentId: number) {
    return this.treatmentSessionService.findByTreatmentId(treatmentId);
  }

  @Put(':id')
  @Roles('ADMIN', 'DOCTOR')
  update(@Param('id', ParseIntPipe) id: number,
    @Body() updateTreatmentSessionDto: UpdateTreatmentSessionDto,
    @CurrentUser() user: { id: number; role: string }
  ) {
    return this.treatmentSessionService.update(id, updateTreatmentSessionDto, user.id);
  }

  @Patch(':id/complete')
  @Roles('ADMIN', 'DOCTOR')
  complete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string }
  ) {
    return this.treatmentSessionService.complete(id, user.id, user.role as any);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.treatmentSessionService.remove(id);
  }
}
