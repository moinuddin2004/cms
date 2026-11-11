import { Controller, Get } from '@nestjs/common';
import { RateLimit } from 'src/auth/guards/rate-limiter.guard';
import { Public } from 'src/common/decorators/publicDecorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { AppVersionService } from './app-version.service';

/**
 * Cold-start gate for the mobile app. Public because the app asks before
 * anyone signs in; the response carries only the two version floors.
 */
@Controller('app')
export class AppVersionController {
  constructor(private readonly appVersion: AppVersionService) {}

  @Public()
  @Get('min-version')
  @RateLimit({ maxAttempts: 60, windowSeconds: 60 })
  minVersion() {
    return ResponseWrapper.success(this.appVersion.getMinVersion());
  }
}
