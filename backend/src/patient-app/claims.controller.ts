import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { RateLimit } from 'src/auth/guards/rate-limiter.guard';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { AcceptClaimDto } from 'src/patient-links/dto/patient-links.dto';
import { ClaimsService } from 'src/patient-links/claims.service';
import { PatientContext, PatientCtx } from './context/patient-context';
import { PatientApi } from './decorators/patient-api.decorator';

const WINDOW_15_MIN = 15 * 60;

/** Claim a clinic record from a QR token (07 §6.2, M2-04). */
@Controller('patient-api/claims')
@PatientApi()
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Get(':token')
  @RateLimit({ maxAttempts: 30, windowSeconds: WINDOW_15_MIN })
  async preview(
    @PatientCtx() ctx: PatientContext,
    @Param('token') token: string,
  ) {
    return ResponseWrapper.success(await this.claims.preview(ctx, token));
  }

  @Post(':token/accept')
  @HttpCode(200)
  @RateLimit({ maxAttempts: 30, windowSeconds: WINDOW_15_MIN })
  async accept(
    @PatientCtx() ctx: PatientContext,
    @Param('token') token: string,
    @Body() dto: AcceptClaimDto,
    @Req() req: Request,
  ) {
    return ResponseWrapper.success(
      await this.claims.accept(ctx, token, dto, req.ip ?? null),
      'Record linked',
    );
  }
}
