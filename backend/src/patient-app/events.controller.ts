import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RateLimit } from 'src/auth/guards/rate-limiter.guard';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { TrackEventsDto } from 'src/product-events/dto/product-events.dto';
import { ProductEventsService } from 'src/product-events/product-events.service';
import { PatientContext, PatientCtx } from './context/patient-context';
import { PatientApi } from './decorators/patient-api.decorator';

/** Patient product analytics (M2-13): allow-listed events, account id only. */
@Controller('patient-api/events')
@PatientApi()
export class PatientEventsController {
  constructor(private readonly events: ProductEventsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @RateLimit({ maxAttempts: 60, windowSeconds: 5 * 60 })
  async track(@PatientCtx() ctx: PatientContext, @Body() dto: TrackEventsDto) {
    return ResponseWrapper.success(
      await this.events.record('patient', ctx.accountId, null, dto.events),
    );
  }
}
