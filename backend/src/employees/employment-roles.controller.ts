import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EmploymentRolesService, RoleActor } from './employment-roles.service';
import { CreateEmploymentRoleDto } from './dto/create-employment-role.dto';
import { UpdateEmploymentRoleDto } from './dto/update-employment-role.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Access, Can } from 'src/access/decorators/access.decorators';
import type { AccessContext } from 'src/access/access-context';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActorSide } from 'src/common/audit/audit.enums';
import type { ActorRef } from 'src/common/audit/audit.enums';

/** Guardrail + audit identity of the caller (super admins audit as platform). */
export function roleActor(access: AccessContext, audit: ActorRef): RoleActor {
  return {
    access,
    audit: {
      ...audit,
      side:
        access.isSuperAdmin && !access.isOwner
          ? ActorSide.PLATFORM
          : ActorSide.CLINIC,
    },
  };
}

/**
 * Legacy role routes (employee form role picker). Writes go through the same
 * guardrails as `/admin/roles`.
 */
@Controller('employment-roles')
export class EmploymentRolesController {
  constructor(private readonly rolesService: EmploymentRolesService) {}

  @Get()
  @Can('employees.view')
  async findAll(@ActiveTenant() ctx: TenantContext) {
    const data = await this.rolesService.findAll(ctx.organizationId);
    return ResponseWrapper.success(
      data,
      'Employment roles retrieved successfully',
    );
  }

  @Get(':id')
  @Can('employees.view')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.rolesService.findOne(id, ctx.organizationId);
    return ResponseWrapper.success(
      data,
      'Employment role retrieved successfully',
    );
  }

  @Post()
  @Can('admin.roles.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateEmploymentRoleDto,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
    @RequestActor(ActorSide.CLINIC) audit: ActorRef,
  ) {
    const data = await this.rolesService.create(
      ctx.organizationId,
      dto,
      roleActor(access, audit),
    );
    return ResponseWrapper.success(
      data,
      'Employment role created successfully',
    );
  }

  @Put(':id')
  @Can('admin.roles.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmploymentRoleDto,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
    @RequestActor(ActorSide.CLINIC) audit: ActorRef,
  ) {
    const data = await this.rolesService.update(
      id,
      ctx.organizationId,
      dto,
      roleActor(access, audit),
    );
    return ResponseWrapper.success(
      data,
      'Employment role updated successfully',
    );
  }

  @Delete(':id')
  @Can('admin.roles.manage')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
    @RequestActor(ActorSide.CLINIC) audit: ActorRef,
  ) {
    await this.rolesService.remove(
      id,
      ctx.organizationId,
      roleActor(access, audit),
    );
    return ResponseWrapper.success(
      null,
      'Employment role deleted successfully',
    );
  }
}
