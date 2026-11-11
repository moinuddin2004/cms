import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RateLimit } from 'src/auth/guards/rate-limiter.guard';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { PatientAuthRoute } from 'src/patient-app/decorators/patient-api.decorator';
import { StartEmailDto, VerifyEmailDto } from './dto/patient-auth.dto';
import { PatientAuthService } from './patient-auth.service';

const WINDOW_15_MIN = 15 * 60;

const meta = (req: Request, label?: string) => ({
  ip: req.ip ?? null,
  deviceLabel: label?.trim() || null,
});

/** Pre-login patient routes: public, rate limited, fenced (07 §5). */
@Controller('patient-auth')
export class PatientAuthController {
  constructor(private readonly auth: PatientAuthService) {}

  /** Always `{ sent: true }` — never reveals whether the email has an account. */
  @Post('email/start')
  @HttpCode(200)
  @PatientAuthRoute()
  @RateLimit({
    maxAttempts: 20,
    windowSeconds: WINDOW_15_MIN,
    perAccountField: 'email',
    perAccountMax: 5,
  })
  async start(@Body() dto: StartEmailDto) {
    await this.auth.startEmail(dto.email);
    return ResponseWrapper.success({ sent: true }, 'Code sent');
  }

  @Post('email/verify')
  @HttpCode(200)
  @PatientAuthRoute()
  @RateLimit({
    maxAttempts: 30,
    windowSeconds: WINDOW_15_MIN,
    perAccountField: 'email',
    perAccountMax: 10,
  })
  async verify(
    @Body() dto: VerifyEmailDto,
    @Req() req: Request,
    @Headers('x-device-label') label?: string,
  ) {
    const session = await this.auth.verifyEmail(dto, meta(req, label));
    return ResponseWrapper.success(session, 'Signed in');
  }

  @Post('refresh')
  @HttpCode(200)
  @PatientAuthRoute()
  @RateLimit({ maxAttempts: 300, windowSeconds: 5 * 60 })
  async refresh(@Headers('x-patient-refresh-token') token?: string) {
    return ResponseWrapper.success(await this.auth.refresh(token), 'Refreshed');
  }

  @Post('logout')
  @HttpCode(200)
  @PatientAuthRoute()
  @RateLimit({ maxAttempts: 60, windowSeconds: 5 * 60 })
  async logout(@Headers('x-patient-refresh-token') token?: string) {
    await this.auth.logout(token);
    return ResponseWrapper.success({ ok: true }, 'Signed out');
  }
}
