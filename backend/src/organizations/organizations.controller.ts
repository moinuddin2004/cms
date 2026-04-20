import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { RequireSuperAdmin } from 'src/common/decorators/require-super-admin.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';

/**
 * Organization management endpoints (super admin only).
 */
@Controller('organizations')
@UseGuards(JwtAuthGuard)
@RequireSuperAdmin()
export class OrganizationsController {
  constructor(private readonly orgService: OrganizationsService) {}

  @Post()
  async create(@Body() dto: CreateOrganizationDto) {
    const org = await this.orgService.create(dto);
    return ResponseWrapper.success(org, 'Organization created');
  }

  @Get()
  async findAll() {
    const orgs = await this.orgService.findAll();
    return ResponseWrapper.success(orgs, 'Organizations retrieved');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const org = await this.orgService.findOne(id);
    return ResponseWrapper.success(org, 'Organization retrieved');
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    const org = await this.orgService.update(id, dto);
    return ResponseWrapper.success(org, 'Organization updated');
  }

  @Delete(':id')
  async deactivate(@Param('id') id: string) {
    const org = await this.orgService.deactivate(id);
    return ResponseWrapper.success(org, 'Organization deactivated');
  }

  @Get(':id/settings')
  async getSettings(@Param('id') id: string) {
    const settings = await this.orgService.getSettings(id);
    return ResponseWrapper.success(settings, 'Organization settings retrieved');
  }

  @Patch(':id/settings')
  async updateSettings(@Param('id') id: string, @Body() dto: any) {
    const settings = await this.orgService.updateSettings(id, dto);
    return ResponseWrapper.success(settings, 'Organization settings updated');
  }
}
