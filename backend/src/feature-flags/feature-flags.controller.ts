import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureAdminService } from './feature-admin.service';
import {
  BulkEntitlementDto,
  BulkToggleDto,
  CreateCatalogItemDto,
  SetEntitlementDto,
  ToggleFeatureDto,
  UpdateCatalogItemDto,
} from './dto/feature-flags.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { RequireSuperAdmin } from 'src/common/decorators/require-super-admin.decorator';
import { ContextFree } from 'src/common/decorators/context-free.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActorSide, type ActorRef } from 'src/common/audit/audit.enums';
import { isUUID } from 'class-validator';
import type { AppRequest } from 'src/common/types/app-request';

@Controller('feature-flags')
@UseGuards(JwtAuthGuard)
export class FeatureFlagsController {
  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly featureAdmin: FeatureAdminService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  // ── Catalog (super admin) ──────────────────────────────────────────

  @Get('catalog')
  @RequireSuperAdmin()
  async getCatalog() {
    const catalog = await this.featureFlagsService.getCatalog();
    return ResponseWrapper.success(catalog, 'Feature catalog retrieved');
  }

  @Post('catalog')
  @RequireSuperAdmin()
  async createCatalogItem(@Body() dto: CreateCatalogItemDto) {
    const item = await this.featureFlagsService.createCatalogItem(dto);
    return ResponseWrapper.success(item, 'Feature catalog item created');
  }

  @Patch('catalog/:id')
  @RequireSuperAdmin()
  async updateCatalogItem(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
  ) {
    const item = await this.featureFlagsService.updateCatalogItem(id, dto);
    return ResponseWrapper.success(item, 'Feature catalog item updated');
  }

  // ── Org flags (super admin) ────────────────────────────────────────

  @Get('org/:organizationId')
  @RequireSuperAdmin()
  async getOrgFeatures(@Param('organizationId') organizationId: string) {
    const groups =
      await this.featureFlagsService.getCatalogWithOrgStatus(organizationId);
    return ResponseWrapper.success(groups, 'Organization features retrieved');
  }

  /** The owner's switch, flipped by the super admin (no entitlement check). */
  @Patch('org/:organizationId/:featureKey')
  @RequireSuperAdmin()
  async toggleFeature(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('featureKey') featureKey: string,
    @Body() dto: ToggleFeatureDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    const flag = await this.featureAdmin.setEnabled(
      organizationId,
      featureKey,
      dto.isEnabled,
      actor,
      { requireEntitled: false },
    );
    return ResponseWrapper.success(flag, 'Feature toggled');
  }

  @Post('org/:organizationId/bulk')
  @RequireSuperAdmin()
  async bulkToggle(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: BulkToggleDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    const result = await this.featureAdmin.bulkSetEnabled(
      organizationId,
      dto.featureKeys,
      dto.isEnabled,
      actor,
    );
    return ResponseWrapper.success(result, 'Features updated');
  }

  // ── Entitlement (super admin) ──────────────────────────────────────

  @Patch('org/:organizationId/:featureKey/entitlement')
  @RequireSuperAdmin()
  async setEntitlement(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('featureKey') featureKey: string,
    @Body() dto: SetEntitlementDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    const flag = await this.featureAdmin.setEntitlement(
      organizationId,
      featureKey,
      { entitled: dto.entitled, until: dto.until },
      actor,
    );
    return ResponseWrapper.success(flag, 'Entitlement updated');
  }

  @Post('org/:organizationId/entitlement/bulk')
  @RequireSuperAdmin()
  async bulkSetEntitlement(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: BulkEntitlementDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    const result = await this.featureAdmin.bulkSetEntitlement(
      organizationId,
      { featureKeys: dto.featureKeys, module: dto.module },
      { entitled: dto.entitled, until: dto.until },
      actor,
    );
    return ResponseWrapper.success(result, 'Entitlements updated');
  }

  @Post('org/:organizationId/seed')
  @RequireSuperAdmin()
  async seedOrgFlags(@Param('organizationId') organizationId: string) {
    await this.featureFlagsService.seedFlagsForOrg(organizationId);
    return ResponseWrapper.success(null, 'Default features seeded');
  }

  // ── Current user's org features ────────────────────────────────────

  @Get('my-features')
  @ContextFree()
  async getMyFeatures(@Req() req: AppRequest) {
    const header = req.headers['x-organization-id'];
    const organizationId = Array.isArray(header) ? header[0] : header;
    if (!organizationId) {
      return ResponseWrapper.success([], 'No active organization');
    }
    // @ContextFree skips TenantContextGuard, so check membership here.
    const userId = req.user?.uuid;
    if (
      !userId ||
      !(await this.authorizationService.canAccessOrganization(
        userId,
        organizationId,
      ))
    ) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }
    // A location only narrows the org set, so an unverified header is safe.
    const location = req.headers['x-location-id'];
    const locationId = Array.isArray(location) ? location[0] : location;
    const enabled = await this.featureFlagsService.getEnabledFeatures(
      organizationId,
      locationId && isUUID(locationId) ? locationId : null,
    );
    return ResponseWrapper.success(
      Array.from(enabled),
      'Enabled features retrieved',
    );
  }
}
