import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { ActorSide } from 'src/common/audit/audit.enums';
import type { ActorRef } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { Public } from 'src/common/decorators/publicDecorator';
import { RequireSuperAdmin } from 'src/common/decorators/require-super-admin.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AppRole } from 'src/common/enums/app-role.enum';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { UpdateLocationThemeDto, UpdateThemeDto } from './theme.dto';
import { ThemeService } from './theme.service';

@Controller()
export class ThemeController {
  constructor(private readonly theme: ThemeService) {}

  /**
   * Login-page theme, before auth: theme tokens only, nothing else about the
   * org. Also listed in `auth/constants/public-routes.ts` (JwtAuthGuard
   * ignores `@Public()`).
   */
  @Public()
  @Get('public/theme/:organizationId')
  async publicTheme(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('locationId') locationId?: string,
  ) {
    const valid = locationId && isUUID(locationId);
    return ResponseWrapper.success(
      await this.theme.resolvePublic(
        organizationId,
        valid ? locationId : undefined,
      ),
    );
  }

  /** The resolved theme for the active tenant — any signed-in member. */
  @Get('theme')
  async current(@ActiveTenant() tenant: TenantContext) {
    return ResponseWrapper.success(
      await this.theme.resolve({
        organizationId: tenant?.organizationId ?? null,
        locationId: tenant?.locationId ?? null,
      }),
    );
  }

  // TODO(access): @Can('admin.theme.manage') — wave 3 replaces @Roles below.
  @Get('admin/theme')
  @Roles(AppRole.CLINIC_ADMIN)
  async orgTheme(@ActiveTenant() tenant: TenantContext) {
    return ResponseWrapper.success(
      await this.theme.orgView(tenant.organizationId),
    );
  }

  // TODO(access): @Can('admin.theme.manage')
  @Put('admin/theme')
  @Roles(AppRole.CLINIC_ADMIN)
  async updateOrgTheme(
    @ActiveTenant() tenant: TenantContext,
    @Body() dto: UpdateThemeDto,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    await this.theme.updateOrg(tenant.organizationId, dto, actor);
    return ResponseWrapper.success(
      await this.theme.orgView(tenant.organizationId),
      'Theme saved',
    );
  }

  // TODO(access): @Can('admin.theme.manage')
  @Get('admin/theme/location/:locationId')
  @Roles(AppRole.CLINIC_ADMIN)
  async locationTheme(
    @ActiveTenant() tenant: TenantContext,
    @Param('locationId', ParseUUIDPipe) locationId: string,
  ) {
    return ResponseWrapper.success(
      await this.theme.locationView(tenant.organizationId, locationId),
    );
  }

  // TODO(access): @Can('admin.theme.manage')
  @Put('admin/theme/location/:locationId')
  @Roles(AppRole.CLINIC_ADMIN)
  async updateLocationTheme(
    @ActiveTenant() tenant: TenantContext,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() dto: UpdateLocationThemeDto,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    await this.theme.updateLocation(
      tenant.organizationId,
      locationId,
      dto,
      actor,
    );
    return ResponseWrapper.success(
      await this.theme.locationView(tenant.organizationId, locationId),
      'Location theme saved',
    );
  }

  @Get('platform/theme')
  @RequireSuperAdmin()
  async platformTheme() {
    return ResponseWrapper.success(await this.theme.platformView());
  }

  @Put('platform/theme')
  @RequireSuperAdmin()
  async updatePlatformTheme(
    @Body() dto: UpdateThemeDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    await this.theme.updatePlatform(dto, actor);
    return ResponseWrapper.success(
      await this.theme.platformView(),
      'Platform theme saved',
    );
  }
}
