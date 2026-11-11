import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ContextFree } from 'src/common/decorators/context-free.decorator';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto, UnregisterDeviceDto } from './dto/device.dto';

/**
 * The signed-in user's push devices (07 §4.2). Registered from the staff app
 * (M1-05) after notification permission is granted; removed on sign-out.
 *
 * `@ContextFree()` only, like `/me/notifications`: a device belongs to the
 * user, not to a clinic, so the route must work without a selected
 * organization (and for users who belong to none). `access-coverage.spec.ts`
 * accepts `@ContextFree` as the marker; `@AnyMember()` would additionally
 * force tenant resolution and 403 exactly those users.
 */
@Controller('me/devices')
@ContextFree()
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  /** Upsert by token: re-registering the same phone keeps one row. */
  @Post()
  @HttpCode(HttpStatus.OK)
  async register(
    @CurrentUserId() userId: string | undefined,
    @Body() dto: RegisterDeviceDto,
  ) {
    return ResponseWrapper.success(
      await this.devices.register(must(userId), dto),
      'Device registered',
    );
  }

  @Delete()
  async unregister(
    @CurrentUserId() userId: string | undefined,
    @Body() dto: UnregisterDeviceDto,
  ) {
    return ResponseWrapper.success(
      await this.devices.unregister(must(userId), dto.expoPushToken),
    );
  }
}

function must(userId: string | undefined): string {
  if (!userId) throw new UnauthorizedException();
  return userId;
}
