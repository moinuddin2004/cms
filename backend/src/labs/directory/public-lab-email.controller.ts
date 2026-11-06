import { RateLimit } from 'src/auth/guards/rate-limiter.guard';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { Public } from 'src/common/decorators/publicDecorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { LabEmailVerificationService } from './lab-email-verification.service';

export class ConfirmLabEmailDto {
  @IsString()
  @Length(32, 128)
  token: string;
}

/** Public: the lab confirms its contact address from the emailed link. */
@Controller('public/lab-email')
export class PublicLabEmailController {
  constructor(private readonly verification: LabEmailVerificationService) {}

  @Public()
  @Post('confirm')
  @RateLimit({ maxAttempts: 20, windowSeconds: 900 })
  @HttpCode(HttpStatus.OK)
  async confirm(@Body() dto: ConfirmLabEmailDto) {
    return ResponseWrapper.success(
      await this.verification.confirm(dto.token),
      'Email confirmed',
    );
  }
}
