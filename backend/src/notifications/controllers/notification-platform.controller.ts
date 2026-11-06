import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { RequireSuperAdmin } from 'src/common/decorators/require-super-admin.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { NotificationSettingsService } from '../services/notification-settings.service';

export class SetPlatformOverrideDto {
  @IsString()
  eventCode: string;

  /** `clinic` removes the override: the clinic's own switch decides again. */
  @IsIn(['on', 'off', 'clinic'])
  mode: 'on' | 'off' | 'clinic';
}

/**
 * Super admin, per clinic: force a mandatory event's email on or off over
 * the clinic's own choice (or hand it back). Mandatory in-app stays on.
 */
@Controller('admin/clinics/:orgId/notification-overrides')
@RequireSuperAdmin()
export class NotificationPlatformController {
  constructor(private readonly settings: NotificationSettingsService) {}

  @Get()
  async list(@Param('orgId', ParseUUIDPipe) orgId: string) {
    return ResponseWrapper.success(
      await this.settings.platformOverrides(orgId),
    );
  }

  @Put()
  async set(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
    @Body() dto: SetPlatformOverrideDto,
  ) {
    return ResponseWrapper.success(
      await this.settings.setPlatformOverride(
        orgId,
        actor,
        dto.eventCode,
        dto.mode,
      ),
      'Mandatory email setting saved',
    );
  }
}
