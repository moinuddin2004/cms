import { Body, Controller, Delete, Get, Put } from '@nestjs/common';
import { ActorSide } from 'src/common/audit/audit.enums';
import type { ActorRef } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import type { AccessContext } from '../access-context';
import { Access, Can } from '../decorators/access.decorators';
import { NavLayoutDto } from './nav-layout.dto';
import type { NavLayoutJson } from './nav-layout.types';
import { NavLayoutsService } from './nav-layouts.service';

/** A super admin editing a clinic is recorded as the platform. */
const asActor = (actor: ActorRef, access: AccessContext): ActorRef => ({
  ...actor,
  side: access.isSuperAdmin ? ActorSide.PLATFORM : ActorSide.CLINIC,
});

/** Sidebar builder (`/admin/navigation`) — the clinic default layout. */
@Controller('admin/navigation')
@Can('admin.nav.manage')
export class NavLayoutsController {
  constructor(private readonly layouts: NavLayoutsService) {}

  /** The clinic layout, or null while the clinic uses the code default. */
  @Get()
  async get(@Access() access: AccessContext) {
    return ResponseWrapper.success(
      await this.layouts.getClinic(access.organizationId),
      'Navigation layout retrieved',
    );
  }

  @Put()
  async save(
    @Body() dto: NavLayoutDto,
    @Access() access: AccessContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.layouts.saveClinic(
        access.organizationId,
        // Entry shape (link vs group) is enforced by navSectionsProblem.
        dto as NavLayoutJson,
        asActor(actor, access),
      ),
      'Navigation layout saved',
    );
  }

  /** Reset to the code default (removes the clinic layout). */
  @Delete()
  async reset(
    @Access() access: AccessContext,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    await this.layouts.resetClinic(
      access.organizationId,
      asActor(actor, access),
    );
    return ResponseWrapper.success(null, 'Navigation reset to default');
  }
}
