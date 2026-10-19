import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireSuperAdmin } from 'src/common/decorators/require-super-admin.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ALL_APP_ROLES } from 'src/common/enums/app-role.enum';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import {
  CreateSpecialtyDto,
  SetOrganizationSpecialtyDto,
  UpdateSpecialtyDto,
} from '../dto/engine.dto';
import { SpecialtiesService } from './specialties.service';

/** Specialties and per-organization enablement — super admins only. */
@Controller('platform/specialties')
@RequireSuperAdmin()
export class PlatformSpecialtiesController {
  constructor(private readonly specialties: SpecialtiesService) {}

  @Get()
  async list() {
    return ResponseWrapper.success(await this.specialties.list());
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateSpecialtyDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.specialties.create(dto, actor),
      'Specialty created',
    );
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpecialtyDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.specialties.update(id, dto, actor),
      'Specialty updated',
    );
  }

  @Get(':id/organizations')
  async organizations(@Param('id', ParseUUIDPipe) id: string) {
    return ResponseWrapper.success(await this.specialties.organizations(id));
  }

  @Put(':id/organizations/:organizationId')
  async setForOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: SetOrganizationSpecialtyDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.specialties.setForOrganization(
        id,
        organizationId,
        dto.isEnabled,
        actor,
      ),
      dto.isEnabled ? 'Specialty enabled' : 'Specialty disabled',
    );
  }
}

/** The specialties the active organization works in. */
@Controller('specialties')
export class SpecialtiesController {
  constructor(private readonly specialties: SpecialtiesService) {}

  @Get()
  @Roles(...ALL_APP_ROLES)
  async enabled(@ActiveTenant() t: TenantContext) {
    return ResponseWrapper.success(
      await this.specialties.enabledFor(t.organizationId),
    );
  }
}
