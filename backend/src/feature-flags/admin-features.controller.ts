import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
} from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActorSide, type ActorRef } from 'src/common/audit/audit.enums';
import { Access, Can } from 'src/access/decorators/access.decorators';
import type { AccessContext } from 'src/access/access-context';
import { FeatureAdminService } from './feature-admin.service';
import {
  SetFeatureEnabledDto,
  SetLocationOverrideDto,
} from './dto/feature-flags.dto';

/**
 * The clinic owner's Features page: switch entitled features on/off for the
 * org and narrow them per location. The org comes from the active tenant.
 */
@Controller('admin/features')
@Can('admin.features.manage')
export class AdminFeaturesController {
  constructor(private readonly featureAdmin: FeatureAdminService) {}

  @Get()
  async list(@Access() access: AccessContext) {
    const view = await this.featureAdmin.getOwnerView(access.organizationId);
    return ResponseWrapper.success(view, 'Features retrieved');
  }

  @Get(':key/impact')
  async impact(@Access() access: AccessContext, @Param('key') key: string) {
    const impact = await this.featureAdmin.getImpact(
      access.organizationId,
      key,
    );
    return ResponseWrapper.success(impact, 'Feature impact retrieved');
  }

  @Patch(':key')
  async setEnabled(
    @Access() access: AccessContext,
    @Param('key') key: string,
    @Body() dto: SetFeatureEnabledDto,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const flag = await this.featureAdmin.setEnabled(
      access.organizationId,
      key,
      dto.enabled,
      actorFor(access, actor),
      { requireEntitled: true },
    );
    return ResponseWrapper.success(
      { key, enabled: flag.isEnabled },
      dto.enabled ? 'Feature turned on' : 'Feature turned off',
    );
  }

  @Put(':key/locations/:locationId')
  async setLocationOverride(
    @Access() access: AccessContext,
    @Param('key') key: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() dto: SetLocationOverrideDto,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    const result = await this.featureAdmin.setLocationOverride(
      access.organizationId,
      key,
      locationId,
      dto.disabled,
      actorFor(access, actor),
    );
    return ResponseWrapper.success(result, 'Location setting saved');
  }
}

/** A super admin acting inside a clinic is still recorded as the platform. */
function actorFor(access: AccessContext, actor: ActorRef): ActorRef {
  return access.isSuperAdmin ? { ...actor, side: ActorSide.PLATFORM } : actor;
}
