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
} from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import {
  BulkToggleDto,
  CreateCatalogItemDto,
  ToggleFeatureDto,
  UpdateCatalogItemDto,
} from './dto/feature-flags.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { RequireSuperAdmin } from 'src/common/decorators/require-super-admin.decorator';
import { ContextFree } from 'src/common/decorators/context-free.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import type { AppRequest } from 'src/common/types/app-request';

@Controller('feature-flags')
@UseGuards(JwtAuthGuard)
export class FeatureFlagsController {
  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
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

  @Patch('org/:organizationId/:featureKey')
  @RequireSuperAdmin()
  async toggleFeature(
    @Param('organizationId') organizationId: string,
    @Param('featureKey') featureKey: string,
    @Body() dto: ToggleFeatureDto,
    @Req() req: any,
  ) {
    const flag = await this.featureFlagsService.toggleFeature(
      organizationId,
      featureKey,
      dto.isEnabled,
      req.user?.uuid,
    );
    return ResponseWrapper.success(flag, 'Feature toggled');
  }

  @Post('org/:organizationId/bulk')
  @RequireSuperAdmin()
  async bulkToggle(
    @Param('organizationId') organizationId: string,
    @Body() dto: BulkToggleDto,
    @Req() req: any,
  ) {
    const result = await this.featureFlagsService.bulkToggle(
      organizationId,
      dto.featureKeys,
      dto.isEnabled,
      req.user?.uuid,
    );
    return ResponseWrapper.success(result, 'Features updated');
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
    const enabled =
      await this.featureFlagsService.getEnabledFeatures(organizationId);
    return ResponseWrapper.success(
      Array.from(enabled),
      'Enabled features retrieved',
    );
  }
}
