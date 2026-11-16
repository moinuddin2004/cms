import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RateLimit } from 'src/auth/guards/rate-limiter.guard';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { PatientContext, PatientCtx } from '../context/patient-context';
import { PatientApi } from '../decorators/patient-api.decorator';
import { PatientAccountLinksService } from './patient-account-links.service';

/** The account's clinic links: list incl. history, unlink (M2-11, P-08). */
@Controller('patient-api/links')
@PatientApi()
export class PatientAccountLinksController {
  constructor(private readonly links: PatientAccountLinksService) {}

  /** Active + frozen links first, then revoked ones (newest first). */
  @Get()
  async list(@PatientCtx() ctx: PatientContext) {
    return ResponseWrapper.success(
      await this.links.list(ctx, { includeRevoked: true }),
    );
  }

  @Delete(':id')
  @HttpCode(200)
  @RateLimit({ maxAttempts: 30, windowSeconds: 15 * 60 })
  async unlink(
    @PatientCtx() ctx: PatientContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.links.unlink(ctx, id),
      'Clinic unlinked',
    );
  }

  @Get(':id/history')
  async history(
    @PatientCtx() ctx: PatientContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(await this.links.history(ctx, id));
  }
}
