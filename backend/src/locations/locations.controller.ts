import { UpdateLocationSettingsDto } from './dto/update-location-settings.dto';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { ContextFree } from 'src/common/decorators/context-free.decorator';
import { AccessResolver, isUuid } from 'src/access/access.resolver';
import type { Permission } from 'src/access/catalog/permissions';
import { noPermission } from 'src/access/decorators/access.decorators';

/** What every location endpoint needs, in the org the location belongs to. */
export const LOCATIONS_PERMISSION: Permission = 'admin.locations.manage';

type LocationsRequest = {
  user: { uuid: string };
  headers: Record<string, string | string[] | undefined>;
};

function header(req: LocationsRequest, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Location management (`admin.locations.manage`).
 * Context-free: an owner manages locations before/without selecting one, so
 * AccessGuard has no tenant to check against. Each handler instead resolves
 * the org from the location acted on (or, for create / list, from the body
 * or the `x-organization-id` header) and checks the permission there.
 */
@Controller('locations')
@UseGuards(JwtAuthGuard)
@ContextFree()
export class LocationsController {
  constructor(
    private readonly locationsService: LocationsService,
    private readonly authorizationService: AuthorizationService,
    private readonly resolver: AccessResolver,
  ) {}

  /**
   * 403 unless the user holds `admin.locations.manage` in `organizationId`.
   * Staff roles are per location: `locationId` is the location acted on,
   * or the caller's active one for org-level calls.
   */
  private async authorize(
    req: LocationsRequest,
    organizationId: string | undefined,
    locationId: string | null,
  ): Promise<string> {
    if (!isUuid(organizationId)) {
      throw new BadRequestException('Select an organization first');
    }
    const access = await this.resolver.resolve(
      req.user.uuid,
      organizationId,
      locationId,
    );
    if (!access.can(LOCATIONS_PERMISSION)) {
      throw noPermission([LOCATIONS_PERMISSION]);
    }
    return organizationId;
  }

  /**
   * Orgs where the user holds `admin.locations.manage` org-wide (owners;
   * staff roles are per location, so they name their org instead).
   * 403 when there is none.
   */
  private async manageableOrganizations(userId: string): Promise<string[]> {
    const { accessibleOrganizations } =
      await this.authorizationService.resolveUserAccess(userId);
    const allowed: string[] = [];
    for (const org of accessibleOrganizations) {
      const access = await this.resolver.resolve(userId, org.id, null);
      if (access.can(LOCATIONS_PERMISSION)) allowed.push(org.id);
    }
    if (!allowed.length) throw noPermission([LOCATIONS_PERMISSION]);
    return allowed;
  }

  /** The caller's active location (header), when it is a valid id. */
  private activeLocation(req: LocationsRequest): string | null {
    const id = header(req, 'x-location-id');
    return isUuid(id) ? id : null;
  }

  /** Loads the location, then checks the permission in its org. */
  private async authorizedLocation(id: string, req: LocationsRequest) {
    const location = await this.locationsService.findOne(id);
    await this.authorize(req, location.organizationId, location.id);
    return location;
  }

  /**
   * Create a new location.
   */
  @Post()
  async create(@Body() dto: CreateLocationDto, @Req() req: LocationsRequest) {
    const organizationId = await this.authorize(
      req,
      dto.organizationId ?? header(req, 'x-organization-id'),
      this.activeLocation(req),
    );

    const location = await this.locationsService.create(
      organizationId,
      dto,
      req.user?.uuid,
    );
    return ResponseWrapper.success(location, 'Location created');
  }

  /**
   * Get all locations: every one for super admins (platform view), else the
   * active organization's (`x-organization-id`), or — with no organization
   * named — those of every org where the user may manage locations.
   */
  @Get()
  async findAll(@Req() req: LocationsRequest) {
    if (await this.authorizationService.isSuperAdmin(req.user.uuid)) {
      const all = await this.locationsService.findAll();
      return ResponseWrapper.success(all, 'Locations retrieved');
    }
    const named = header(req, 'x-organization-id');
    const organizationIds = named
      ? [await this.authorize(req, named, this.activeLocation(req))]
      : await this.manageableOrganizations(req.user.uuid);
    const locations = (
      await Promise.all(
        organizationIds.map((id) =>
          this.locationsService.findByOrganization(id),
        ),
      )
    ).flat();
    return ResponseWrapper.success(locations, 'Locations retrieved');
  }

  /**
   * Get a single location.
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: LocationsRequest) {
    const location = await this.authorizedLocation(id, req);
    return ResponseWrapper.success(location, 'Location retrieved');
  }

  /**
   * Update a location.
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
    @Req() req: LocationsRequest,
  ) {
    await this.authorizedLocation(id, req);

    const location = await this.locationsService.update(
      id,
      dto,
      req.user?.uuid,
    );
    return ResponseWrapper.success(location, 'Location updated');
  }

  /**
   * Deactivate a location (soft-delete).
   */
  @Delete(':id')
  async deactivate(@Param('id') id: string, @Req() req: LocationsRequest) {
    await this.authorizedLocation(id, req);

    const location = await this.locationsService.deactivate(id);
    return ResponseWrapper.success(location, 'Location deactivated');
  }

  // ── Settings ──

  @Get(':id/settings')
  async getSettings(@Param('id') id: string, @Req() req: LocationsRequest) {
    await this.authorizedLocation(id, req);

    const settings = await this.locationsService.getSettings(id);
    return ResponseWrapper.success(settings, 'Settings retrieved');
  }

  @Patch(':id/settings')
  async updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateLocationSettingsDto,
    @Req() req: LocationsRequest,
  ) {
    await this.authorizedLocation(id, req);

    const settings = await this.locationsService.updateSettings(id, dto);
    return ResponseWrapper.success(settings, 'Settings updated');
  }
}
