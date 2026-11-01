// src/modules/payment/payment.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { PaymentKpisQueryDto } from './dto/payment-kpis.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
// 🔥 Asegúrate de que esta ruta sea la correcta en tu proyecto
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard'; 

@Controller('payments')
@UseGuards(JwtAuthGuard) // 🔥 Protege todas las rutas de este controlador
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) { }

    @Get('kpis')
    async getKpis(
        @Query() query: PaymentKpisQueryDto,
        @CurrentUser() user: any
    ) {
        return this.paymentService.getKPIs(query, user.clinicId);
    }

    @Get('pending-balances')
    getPendingBalances(@CurrentUser() user: any) {
        return this.paymentService.getPendingBalances(user.clinicId); 
    }

    @Get()
    findAll(@Query() query: PaymentQueryDto, @CurrentUser() user: any) {
        return this.paymentService.findAll(query, user.clinicId);
    }
}