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

/** Public: the lab confirms its contact address from the emailed link (also in PUBLIC_ROUTES). */
@Controller('public/lab-email')
export class PublicLabEmailController {
  constructor(private readonly verification: LabEmailVerificationService) {}

  @Public()
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(@Body() dto: ConfirmLabEmailDto) {
    return ResponseWrapper.success(
      await this.verification.confirm(dto.token),
      'Email confirmed',
    );
  }
}
