import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { RateLimit } from 'src/auth/guards/rate-limiter.guard';
import { ContextFree } from 'src/common/decorators/context-free.decorator';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { TrackEventsDto } from './dto/product-events.dto';
import { ProductEventsService } from './product-events.service';

/**
 * Staff product analytics (M2-13). `@ContextFree()` like `/me/devices`: the
 * sign-in event is sent before an organization/location is selected, and
 * nothing here reads clinic data. The org id is therefore never stored from
 * the client; metrics join `actor_id` → employees when they need a clinic.
 */
@Controller('me/events')
@ContextFree()
export class StaffEventsController {
  constructor(private readonly events: ProductEventsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @RateLimit({ maxAttempts: 60, windowSeconds: 5 * 60 })
  async track(
    @CurrentUserId() userId: string | undefined,
    @Body() dto: TrackEventsDto,
  ) {
    if (!userId) throw new UnauthorizedException();
    return ResponseWrapper.success(
      await this.events.record('staff', userId, null, dto.events),
    );
  }
}
