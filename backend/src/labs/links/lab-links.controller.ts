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
import { AnyMember, Can } from 'src/access/decorators/access.decorators';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
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
 * clinic may read it (doctors pick a lab when ordering, billing filters by
 * lab); `lab.links.manage` changes it. The `@AnyMember` reads keep the lab
 * feature gate (a `@Can` permission implies its feature, membership doesn't).
 */
@Controller('lab-links')
export class LabLinksController {
  constructor(private readonly links: LabLinksService) {}

  @Get()
  @AnyMember()
  @RequireFeature(LAB_FEATURE)
  async list(
    @ActiveTenant() t: TenantContext,
    @Query() q: ListLabLinksQueryDto,
  ) {
    return ResponseWrapper.success(await this.links.list(t.organizationId, q));
  }

  /** Labs this clinic can add. Declared before `:id`. */
  @Get('directory')
  @Can('lab.links.manage')
  async directory(
    @ActiveTenant() t: TenantContext,
    @Query() q: LabDirectoryQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.links.directory(t.organizationId, q),
    );
  }

  @Get(':id')
  @AnyMember()
  @RequireFeature(LAB_FEATURE)
  async get(
    @ActiveTenant() t: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(await this.links.get(t.organizationId, id));
  }

  @Get(':id/history')
  @Can('lab.links.manage')
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
  @Can('lab.links.manage')
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
  @Can('lab.links.manage')
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
  @Can('lab.links.manage')
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
