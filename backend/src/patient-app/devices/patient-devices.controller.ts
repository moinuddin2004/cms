import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { RateLimit } from 'src/auth/guards/rate-limiter.guard';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import {
  RegisterDeviceDto,
  UnregisterDeviceDto,
} from 'src/devices/dto/device.dto';
import { PatientDevicesService } from 'src/patient-devices/patient-devices.service';
import { PatientContext, PatientCtx } from '../context/patient-context';
import { PatientApi } from '../decorators/patient-api.decorator';

const WINDOW_15_MIN = 15 * 60;

/**
 * The caller's push devices (M3-07, 07 §4.2 shape). A device belongs to the
 * ACCOUNT, never to one link or clinic — registering needs no clinic link, and
 * the same body as the staff `/me/devices` is used on purpose.
 */
@Controller('patient-api/devices')
@PatientApi()
export class PatientDevicesController {
  constructor(private readonly devices: PatientDevicesService) {}

  /** Upsert by token: re-registering the same phone keeps one row. */
  @Post()
  @HttpCode(HttpStatus.OK)
  @RateLimit({ maxAttempts: 60, windowSeconds: WINDOW_15_MIN })
  async register(
    @PatientCtx() ctx: PatientContext,
    @Body() dto: RegisterDeviceDto,
  ) {
    return ResponseWrapper.success(
      await this.devices.register(ctx.accountId, ctx.sessionId, dto),
      'Device registered',
    );
  }

  @Delete()
  async unregister(
    @PatientCtx() ctx: PatientContext,
    @Body() dto: UnregisterDeviceDto,
  ) {
    return ResponseWrapper.success(
      await this.devices.unregister(ctx.accountId, dto.expoPushToken),
    );
  }
}
