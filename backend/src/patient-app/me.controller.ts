import { Body, Controller, Delete, Get, HttpCode, Patch } from '@nestjs/common';
import { RateLimit } from 'src/auth/guards/rate-limiter.guard';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { PatientAccountService } from './account/patient-account.service';
import { DeleteAccountDto } from './account/delete-account.dto';
import { PatientContext, PatientCtx } from './context/patient-context';
import { PatientApi } from './decorators/patient-api.decorator';
import { UpdatePatientMeDto } from './dto/patient-me.dto';
import { PatientMeService } from './patient-me.service';

@Controller('patient-api/me')
@PatientApi()
export class PatientMeController {
  constructor(
    private readonly me: PatientMeService,
    private readonly account: PatientAccountService,
  ) {}

  @Get()
  async get(@PatientCtx() ctx: PatientContext) {
    return ResponseWrapper.success(await this.me.get(ctx));
  }

  @Patch()
  async update(
    @PatientCtx() ctx: PatientContext,
    @Body() dto: UpdatePatientMeDto,
  ) {
    return ResponseWrapper.success(
      await this.me.updateName(ctx, dto.fullName),
      'Profile updated',
    );
  }

  /** Irreversible: revokes links + sessions, wipes identities (M2-11). */
  @Delete()
  @HttpCode(200)
  @RateLimit({ maxAttempts: 5, windowSeconds: 15 * 60 })
  async remove(
    @PatientCtx() ctx: PatientContext,
    @Body() dto: DeleteAccountDto,
  ) {
    // The DTO validation (confirm === DELETE) is the check; nothing else is read from the body.
    void dto;
    return ResponseWrapper.success(
      await this.account.deleteAccount(ctx),
      'Account deleted',
    );
  }
}
