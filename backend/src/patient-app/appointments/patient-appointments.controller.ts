import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { RateLimit } from 'src/auth/guards/rate-limiter.guard';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { PatientContext, PatientCtx } from '../context/patient-context';
import { PatientApi } from '../decorators/patient-api.decorator';
import { PatientAppointmentsService } from './patient-appointments.service';

@Controller('patient-api/appointments')
@PatientApi()
export class PatientAppointmentsController {
  constructor(private readonly appointments: PatientAppointmentsService) {}

  @Post(':id/confirm')
  @HttpCode(200)
  @RateLimit({ maxAttempts: 60, windowSeconds: 15 * 60 })
  async confirm(@PatientCtx() ctx: PatientContext, @Param('id') id: string) {
    return ResponseWrapper.success(await this.appointments.confirm(ctx, id));
  }
}
