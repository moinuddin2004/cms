import { Controller, Get } from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { PatientContext, PatientCtx } from '../context/patient-context';
import { PatientApi } from '../decorators/patient-api.decorator';
import { PatientQueueService } from './patient-queue.service';

/** The patient's live queue entries (M3-05). */
@Controller('patient-api/queue')
@PatientApi()
export class PatientQueueController {
  constructor(private readonly queue: PatientQueueService) {}

  @Get('active')
  async active(@PatientCtx() ctx: PatientContext) {
    return ResponseWrapper.success(await this.queue.active(ctx));
  }
}
