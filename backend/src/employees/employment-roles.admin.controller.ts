import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Access, Can } from 'src/access/decorators/access.decorators';
import type { AccessContext } from 'src/access/access-context';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActorSide } from 'src/common/audit/audit.enums';
import type { ActorRef } from 'src/common/audit/audit.enums';
import { EmploymentRolesService } from './employment-roles.service';
import { roleActor } from './employment-roles.controller';
import { CreateEmploymentRoleDto } from './dto/create-employment-role.dto';
import { UpdateEmploymentRoleDto } from './dto/update-employment-role.dto';
import { CloneEmploymentRoleDto } from './dto/clone-employment-role.dto';

/**
 * Roles & permission bundles screen (`/admin/roles`, Clinic setup).
 * Guardrails (no escalation, read-only system roles, reason for high-risk
 * grants, no delete while in use, audit) live in the service.
 */
@Controller('admin/roles')
@Can('admin.roles.manage')
export class EmploymentRolesAdminController {
  constructor(private readonly roles: EmploymentRolesService) {}

  @Get()
  async list(@ActiveTenant() ctx: TenantContext) {
    const data = await this.roles.list(ctx.organizationId);
    return ResponseWrapper.success(data, 'Roles retrieved');
  }

  @Get(':id')
  async detail(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.roles.detail(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Role retrieved');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateEmploymentRoleDto,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
    @RequestActor(ActorSide.CLINIC) audit: ActorRef,
  ) {
    const role = await this.roles.create(
      ctx.organizationId,
      dto,
      roleActor(access, audit),
    );
    const data = await this.roles.detail(role.id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Role created');
  }

  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  async clone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloneEmploymentRoleDto,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
    @RequestActor(ActorSide.CLINIC) audit: ActorRef,
  ) {
    const role = await this.roles.clone(
      id,
      ctx.organizationId,
      dto,
      roleActor(access, audit),
    );
    const data = await this.roles.detail(role.id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Role cloned');
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmploymentRoleDto,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
    @RequestActor(ActorSide.CLINIC) audit: ActorRef,
  ) {
    await this.roles.update(
      id,
      ctx.organizationId,
      dto,
      roleActor(access, audit),
    );
    const data = await this.roles.detail(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Role updated');
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
    @RequestActor(ActorSide.CLINIC) audit: ActorRef,
  ) {
    await this.roles.remove(id, ctx.organizationId, roleActor(access, audit));
    return ResponseWrapper.success(null, 'Role deleted');
  }
}
