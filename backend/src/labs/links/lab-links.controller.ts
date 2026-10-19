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
  Query,
} from '@nestjs/common';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { AppRole, ALL_APP_ROLES } from 'src/common/enums/app-role.enum';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import {
  CreateLabLinkDto,
  LabDirectoryQueryDto,
  LabLinkTransitionDto,
  ListLabLinksQueryDto,
  UpdateLabLinkDto,
} from '../dto/lab.dto';
import { LAB_FEATURE } from '../labs.constants';
import { LabLinksService } from './lab-links.service';

const TRANSITION_MESSAGES = {
  activate: 'Lab activated',
  suspend: 'Lab suspended',
  reactivate: 'Lab reactivated',
} as const;

/**
 * The clinic's own lab list (lab ↔ clinic links). Every member of the
 * clinic may read it (doctors pick a lab when ordering); only clinic admins
 * change it.
 */
@Controller('lab-links')
@RequireFeature(LAB_FEATURE)
export class LabLinksController {
  constructor(private readonly links: LabLinksService) {}

  @Get()
  @Roles(...ALL_APP_ROLES)
  async list(
    @ActiveTenant() t: TenantContext,
    @Query() q: ListLabLinksQueryDto,
  ) {
    return ResponseWrapper.success(await this.links.list(t.organizationId, q));
  }

  /** Labs this clinic can add. Declared before `:id`. */
  @Get('directory')
  @Roles(AppRole.CLINIC_ADMIN)
  async directory(
    @ActiveTenant() t: TenantContext,
    @Query() q: LabDirectoryQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.links.directory(t.organizationId, q),
    );
  }

  @Get(':id')
  @Roles(...ALL_APP_ROLES)
  async get(
    @ActiveTenant() t: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(await this.links.get(t.organizationId, id));
  }

  @Get(':id/history')
  @Roles(AppRole.CLINIC_ADMIN)
  async history(
    @ActiveTenant() t: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.links.history(t.organizationId, id),
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(AppRole.CLINIC_ADMIN)
  async create(
    @ActiveTenant() t: TenantContext,
    @Body() dto: CreateLabLinkDto,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.links.create(t.organizationId, dto, actor),
      'Lab added — activate it once the lab confirms',
    );
  }

  @Patch(':id')
  @Roles(AppRole.CLINIC_ADMIN)
  async update(
    @ActiveTenant() t: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLabLinkDto,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.links.update(t.organizationId, id, dto, actor),
      'Lab terms updated',
    );
  }

  @Post(':id/transitions')
  @Roles(AppRole.CLINIC_ADMIN)
  async transition(
    @ActiveTenant() t: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LabLinkTransitionDto,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.links.transition(t.organizationId, id, dto, actor),
      TRANSITION_MESSAGES[dto.action],
    );
  }
}
