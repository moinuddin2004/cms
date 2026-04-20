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
  ForbiddenException,
} from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { GlobalRole } from 'src/common/enums/global-role.enum';

/**
 * Location management endpoints.
 * Most operations require tenant context (organization + location headers).
 */
@Controller('locations')
@UseGuards(JwtAuthGuard)
export class LocationsController {
  constructor(
    private readonly locationsService: LocationsService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  /**
   * Helper to derive the allowed organizationId for the user.
   */
  private async getAuthorizedOrgId(
    user: any,
  ): Promise<{ orgId: string | null; isSA: boolean }> {
    const isSA = await this.authorizationService.isSuperAdmin(user.uuid);
    if (isSA) return { orgId: null, isSA: true };

    // Find owned organization
    const access = await this.authorizationService.resolveUserAccess(user.uuid);
    const ownerOrgs = access.accessibleOrganizations.filter(
      (o) => o.accessSource === 'owner',
    );

    if (ownerOrgs.length === 0) {
      throw new ForbiddenException(
        'You do not have permission to manage locations',
      );
    }
    // Assuming single organization per owner for now
    return { orgId: ownerOrgs[0].id, isSA: false };
  }

  /**
   * Create a new location.
   */
  @Post()
  async create(@Body() dto: CreateLocationDto, @Req() req: any) {
    const { orgId, isSA } = await this.getAuthorizedOrgId(req.user);

    let finalOrgId: string;
    if (isSA) {
      if (!dto.organizationId) {
        throw new ForbiddenException('Super Admin must provide organizationId');
      }
      finalOrgId = dto.organizationId;
    } else {
      if (!orgId) throw new ForbiddenException();
      finalOrgId = orgId;
    }

    const location = await this.locationsService.create(
      finalOrgId,
      dto,
      req.user?.uuid,
    );
    return ResponseWrapper.success(location, 'Location created');
  }

  /**
   * Get all locations.
   */
  @Get()
  async findAll(@Req() req: any) {
    const { orgId, isSA } = await this.getAuthorizedOrgId(req.user);

    let locations;
    if (isSA) {
      locations = await this.locationsService.findAll(); // We must add findAll() to locationsService
    } else {
      if (!orgId) throw new ForbiddenException();
      locations = await this.locationsService.findByOrganization(orgId);
    }
    return ResponseWrapper.success(locations, 'Locations retrieved');
  }

  /**
   * Get a single location.
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const { orgId, isSA } = await this.getAuthorizedOrgId(req.user);
    const location = await this.locationsService.findOne(id);

    if (!isSA && location.organizationId !== orgId) {
      throw new ForbiddenException('You cannot access this location');
    }

    return ResponseWrapper.success(location, 'Location retrieved');
  }

  /**
   * Update a location.
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
    @Req() req: any,
  ) {
    const { orgId, isSA } = await this.getAuthorizedOrgId(req.user);
    const existing = await this.locationsService.findOne(id);

    if (!isSA && existing.organizationId !== orgId) {
      throw new ForbiddenException('You cannot modify this location');
    }

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
  async deactivate(@Param('id') id: string, @Req() req: any) {
    const { orgId, isSA } = await this.getAuthorizedOrgId(req.user);
    const existing = await this.locationsService.findOne(id);

    if (!isSA && existing.organizationId !== orgId) {
      throw new ForbiddenException('You cannot delete this location');
    }

    const location = await this.locationsService.deactivate(id);
    return ResponseWrapper.success(location, 'Location deactivated');
  }

  // ── Settings ──

  @Get(':id/settings')
  async getSettings(@Param('id') id: string, @Req() req: any) {
    const { orgId, isSA } = await this.getAuthorizedOrgId(req.user);
    const existing = await this.locationsService.findOne(id);

    if (!isSA && existing.organizationId !== orgId) {
      throw new ForbiddenException(
        'You cannot access settings for this location',
      );
    }

    const settings = await this.locationsService.getSettings(id);
    return ResponseWrapper.success(settings, 'Settings retrieved');
  }

  @Patch(':id/settings')
  async updateSettings(
    @Param('id') id: string,
    @Body() dto: any,
    @Req() req: any,
  ) {
    const { orgId, isSA } = await this.getAuthorizedOrgId(req.user);
    const existing = await this.locationsService.findOne(id);

    if (!isSA && existing.organizationId !== orgId) {
      throw new ForbiddenException(
        'You cannot modify settings for this location',
      );
    }

    const settings = await this.locationsService.updateSettings(id, dto);
    return ResponseWrapper.success(settings, 'Settings updated');
  }
}
