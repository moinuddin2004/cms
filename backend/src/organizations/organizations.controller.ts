import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
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
  ParseUUIDPipe,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { RequireSuperAdmin } from 'src/common/decorators/require-super-admin.decorator';
import { ContextFree } from 'src/common/decorators/context-free.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { AuthorizationService } from 'src/auth/services/authorization.service';

/**
 * Organization management endpoints (super admin only).
 * Every handler carries @RequireSuperAdmin() except reading an org's
 * settings, which the org's owners need on the location settings page.
 */
@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(
    private readonly orgService: OrganizationsService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  @Post()
  @RequireSuperAdmin()
  async create(@Body() dto: CreateOrganizationDto) {
    const org = await this.orgService.create(dto);
    return ResponseWrapper.success(org, 'Organization created');
  }

  @Get()
  @RequireSuperAdmin()
  async findAll() {
    const orgs = await this.orgService.findAll();
    return ResponseWrapper.success(orgs, 'Organizations retrieved');
  }

  @Get(':id')
  @RequireSuperAdmin()
  async findOne(@Param('id') id: string) {
    const org = await this.orgService.findOne(id);
    return ResponseWrapper.success(org, 'Organization retrieved');
  }

  @Patch(':id')
  @RequireSuperAdmin()
  async update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    const org = await this.orgService.update(id, dto);
    return ResponseWrapper.success(org, 'Organization updated');
  }

  @Delete(':id')
  @RequireSuperAdmin()
  async deactivate(@Param('id') id: string) {
    const org = await this.orgService.deactivate(id);
    return ResponseWrapper.success(org, 'Organization deactivated');
  }

  /** Super admin, or an owner of this organization. */
  @Get(':id/settings')
  @ContextFree()
  async getSettings(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const userId: string = req.user?.uuid;
    const allowed =
      (await this.authorizationService.isSuperAdmin(userId)) ||
      (await this.authorizationService.isOwner(userId, id));
    if (!allowed) {
      throw new ForbiddenException(
        'You cannot access settings for this organization',
      );
    }
    const settings = await this.orgService.getSettings(id);
    return ResponseWrapper.success(settings, 'Organization settings retrieved');
  }

  @Patch(':id/settings')
  @RequireSuperAdmin()
  async updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationSettingsDto,
  ) {
    const settings = await this.orgService.updateSettings(id, dto);
    return ResponseWrapper.success(settings, 'Organization settings updated');
  }
}
