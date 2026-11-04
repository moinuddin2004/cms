import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import {
  Access,
  AnyMember,
  Can,
} from 'src/access/decorators/access.decorators';
import type { AccessContext } from 'src/access/access-context';
import { RequireSuperAdmin } from 'src/common/decorators/require-super-admin.decorator';
import { ContextFree } from 'src/common/decorators/context-free.decorator';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import type { AppRequest } from 'src/common/types/app-request';
import { ClinicAccessService } from './clinic-access.service';
import { JoinRequestStatus } from './entities/clinic-join-request.entity';
import {
  ApproveJoinRequestDto,
  ClinicApprovalDecisionDto,
  RejectJoinRequestDto,
  UpdateSignInPolicyDto,
} from './dto/clinic-access.dto';

/** Super admin: approve or reject a self-signup clinic. */
@Controller('admin/clinics')
@RequireSuperAdmin()
export class ClinicApprovalController {
  constructor(private readonly service: ClinicAccessService) {}

  @Post(':orgId/approval')
  async decide(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: ClinicApprovalDecisionDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    const result = await this.service.decideApproval(orgId, dto, actor);
    return ResponseWrapper.success(
      result,
      dto.decision === 'approve' ? 'Clinic approved' : 'Clinic rejected',
    );
  }
}

/** The clinic owner's sign-in policy (Settings → Sign-in). */
@Controller('clinic/sign-in-policy')
export class SignInPolicyController {
  constructor(private readonly service: ClinicAccessService) {}

  @Get()
  @AnyMember()
  async get(@Access() access: AccessContext, @Req() req: AppRequest) {
    assertOwner(access);
    return ResponseWrapper.success(
      {
        policy: await this.service.getPolicy(access.organizationId),
        googleConfigured: !!process.env.GOOGLE_CLIENT_ID,
        sessionMethod: req.user?.authMethod ?? 'password',
        sessionDomain: req.user?.authDomain ?? null,
      },
      'Sign-in policy retrieved',
    );
  }

  @Put()
  @AnyMember()
  async save(
    @Access() access: AccessContext,
    @Req() req: AppRequest,
    @Body() dto: UpdateSignInPolicyDto,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    assertOwner(access);
    const policy = await this.service.savePolicy(
      access.organizationId,
      dto,
      {
        method: req.user?.authMethod ?? 'password',
        domain: req.user?.authDomain ?? null,
        isSuperAdmin: access.isSuperAdmin,
      },
      actor,
    );
    return ResponseWrapper.success({ policy }, 'Sign-in policy saved');
  }
}

/** Join requests: owners/managers decide; requesters see their own. */
@Controller('join-requests')
export class JoinRequestsController {
  constructor(private readonly service: ClinicAccessService) {}

  /** The signed-in user's own requests (no clinic context needed). */
  @Get('mine')
  @ContextFree()
  async mine(@Req() req: AppRequest) {
    if (!req.user?.uuid) throw new ForbiddenException('Not signed in');
    return ResponseWrapper.success(
      await this.service.myJoinRequests(req.user.uuid),
      'Join requests retrieved',
    );
  }

  @Get()
  @Can('employees.manage')
  async list(
    @ActiveTenant() ctx: TenantContext,
    @Query('status') status?: string,
  ) {
    const s = Object.values(JoinRequestStatus).includes(
      status as JoinRequestStatus,
    )
      ? (status as JoinRequestStatus)
      : undefined;
    return ResponseWrapper.success(
      await this.service.listJoinRequests(ctx.organizationId, s),
      'Join requests retrieved',
    );
  }

  @Post(':id/approve')
  @Can('employees.manage')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveJoinRequestDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: AppRequest,
  ) {
    return ResponseWrapper.success(
      await this.service.approveJoinRequest(id, ctx, dto, req.user!.uuid),
      'Join request approved',
    );
  }

  @Post(':id/reject')
  @Can('employees.manage')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectJoinRequestDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: AppRequest,
  ) {
    return ResponseWrapper.success(
      await this.service.rejectJoinRequest(
        id,
        ctx.organizationId,
        dto.reason,
        req.user!.uuid,
      ),
      'Join request rejected',
    );
  }
}

function assertOwner(access: AccessContext) {
  if (!access.isOwner && !access.isSuperAdmin) {
    throw new ForbiddenException('Only the clinic owner can do this');
  }
}
