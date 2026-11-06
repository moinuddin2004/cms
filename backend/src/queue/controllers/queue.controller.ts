import { PatientInScope } from 'src/patients/access/patient-scope';
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
  Query,
} from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { legacyRolesFromPermissions } from 'src/access/legacy-roles';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import type { AccessContext } from 'src/access/access-context';
import {
  Access,
  AnyMember,
  Can,
  noPermission,
} from 'src/access/decorators/access.decorators';
import {
  QueueOrchestrator,
  IdempotencyInput,
} from '../services/queue-orchestrator.service';
import { QueueQueryService } from '../services/queue-query.service';
import { QueuePoliciesService } from '../services/queue-policies.service';
import {
  CurrentQueueActor,
  Idempotency,
  IfMatch,
} from '../decorators/queue-request.decorators';
import {
  EnsureSessionDto,
  ReasonDto,
  RejoinDto,
  RequiredReasonDto,
  TransferDto,
  WalkInDto,
} from '../dto/queue.dto';
import { UpdateQueuePolicyDto } from '../dto/update-queue-policy.dto';
import { QueueErrors } from '../queue.errors';
import {
  assertAnyOf,
  canRunSession,
  QueueActor,
  queueActorFrom,
} from '../queue-actor';

/**
 * Reading one doctor's session: the reception board sees every lane; a
 * doctor without it sees only the sessions they may run.
 */
function assertCanReadSession(access: AccessContext, doctorId: string) {
  if (access.can('queue.board.view')) return;
  if (canRunSession(queueActorFrom(access), doctorId)) return;
  throw noPermission(['queue.board.view'], "You can't see this doctor's queue");
}

/**
 * Reception side of the queue, plus reads and settings. Every mutation goes
 * through QueueOrchestrator and needs an Idempotency-Key header; actions on
 * one entry accept `If-Match: <version>`. Permissions come from the
 * catalog's Queue group; the orchestrator re-checks the per-session rules.
 */
@Controller('queue')
export class QueueController {
  constructor(
    private readonly orchestrator: QueueOrchestrator,
    private readonly query: QueueQueryService,
    private readonly policies: QueuePoliciesService,
  ) {}

  // ─── Reads ─────────────────────────────────────────────────────

  /**
   * The signed-in user's clinic roles at the active location, so the UI can
   * hide actions the server would refuse. The server still enforces them.
   */
  @AnyMember()
  @Get('me')
  me(@Access() access: AccessContext) {
    return ResponseWrapper.success(
      {
        roles: legacyRolesFromPermissions(access.permissions),
        employeeId: access.employeeId,
      },
      'Your queue roles',
    );
  }

  /** Reception board: every doctor's lane for a service date (default today). */
  @Can('queue.board.view')
  @Get('sessions')
  async lanes(
    @Query('date') date: string | undefined,
    @ActiveTenant() ctx: TenantContext,
  ) {
    return ResponseWrapper.success(
      await this.query.lanes(ctx, date),
      'Queues retrieved',
    );
  }

  @AnyMember()
  @Get('sessions/:id')
  async snapshot(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    const snap = await this.query.snapshot(ctx, id);
    assertCanReadSession(access, snap.session.doctorId);
    return ResponseWrapper.success(snap, 'Queue retrieved');
  }

  /** What Call Next would pick now; reserves nothing. */
  @AnyMember()
  @Get('sessions/:id/next-preview')
  async nextPreview(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    const snap = await this.query.snapshot(ctx, id);
    assertCanReadSession(access, snap.session.doctorId);
    return ResponseWrapper.success(
      {
        suggestion: snap.suggestion,
        waitingOrder: snap.waitingOrder,
        eventSeq: snap.session.eventSeq,
      },
      'Next patient preview',
    );
  }

  /** The queue's audit history. */
  @Can('admin.audit.view')
  @Get('sessions/:id/events')
  async events(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('afterSeq') afterSeq: string | undefined,
    @ActiveTenant() ctx: TenantContext,
  ) {
    return ResponseWrapper.success(
      await this.query.events(ctx, id, Number(afterSeq) || 0),
      'Queue history retrieved',
    );
  }

  @AnyMember()
  @Get('entries/:id/ticket')
  async ticket(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    assertAnyOf(access, 'queue.board.view', 'queue.doctor.own');
    return ResponseWrapper.success(
      await this.query.ticket(ctx, id),
      'Ticket retrieved',
    );
  }

  /** A patient's visits — booked and walk-in — for the patient record. */
  @Can('patients.view')
  @PatientInScope('patientId')
  @Get('patients/:patientId/visits')
  async visits(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    return ResponseWrapper.success(
      await this.query.patientVisits(ctx, patientId),
      'Visits retrieved',
    );
  }

  // ─── Arrivals ──────────────────────────────────────────────────

  @Can('queue.checkin')
  @Post('walk-ins')
  @HttpCode(HttpStatus.CREATED)
  async walkIn(
    @Body() dto: WalkInDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    const data = await this.orchestrator.registerWalkIn(ctx, actor, dto, idem);
    return ResponseWrapper.success(data, `Walk-in added — token ${data.token}`);
  }

  /**
   * Make sure a doctor's session exists today (opens an empty lane).
   * Reception (`queue.checkin`) for any doctor; a doctor for a session they
   * may run — the orchestrator checks which.
   */
  @AnyMember()
  @Post('sessions')
  async ensureSession(
    @Body() dto: EnsureSessionDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
  ) {
    const doctorId = dto.doctorId ?? actor.employeeId;
    if (!doctorId) throw QueueErrors.notFound('Doctor for this user');
    const { sessionId } = await this.orchestrator.ensureTodaySession(
      ctx,
      actor,
      doctorId,
    );
    return ResponseWrapper.success(
      await this.query.snapshot(ctx, sessionId),
      'Queue ready',
    );
  }

  // ─── Reception actions on an entry ─────────────────────────────

  @Can('queue.entry.manage')
  @Patch('entries/:id/cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @IfMatch() ifMatch: number | undefined,
    @Idempotency() idem: IdempotencyInput,
  ) {
    const data = await this.orchestrator.cancel(
      ctx,
      actor,
      id,
      dto.reason,
      ifMatch,
      idem,
    );
    return ResponseWrapper.success(data, 'Removed from the queue');
  }

  @Can('queue.entry.manage')
  @Patch('entries/:id/rejoin')
  async rejoin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejoinDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @IfMatch() ifMatch: number | undefined,
    @Idempotency() idem: IdempotencyInput,
  ) {
    const data = await this.orchestrator.rejoin(
      ctx,
      actor,
      id,
      dto,
      ifMatch,
      idem,
    );
    return ResponseWrapper.success(data, 'Back in the queue');
  }

  @Can('queue.checkin')
  @Patch('entries/:id/return-from-test')
  async returnFromTest(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @IfMatch() ifMatch: number | undefined,
    @Idempotency() idem: IdempotencyInput,
  ) {
    const data = await this.orchestrator.returnFromTest(
      ctx,
      actor,
      id,
      ifMatch,
      idem,
    );
    return ResponseWrapper.success(data, 'Back from test');
  }

  /** Reception (`queue.entry.manage`) or the doctor of the entry's session. */
  @AnyMember()
  @Patch('entries/:id/transfer')
  async transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @IfMatch() ifMatch: number | undefined,
    @Idempotency() idem: IdempotencyInput,
  ) {
    const data = await this.orchestrator.transfer(
      ctx,
      actor,
      id,
      dto,
      ifMatch,
      idem,
    );
    return ResponseWrapper.success(
      data,
      `Transferred — new token ${data.token}`,
    );
  }

  /** Emergency priority, reason required. */
  @Can('queue.entry.reprioritize')
  @Patch('entries/:id/priority')
  async priority(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequiredReasonDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @IfMatch() ifMatch: number | undefined,
    @Idempotency() idem: IdempotencyInput,
  ) {
    const data = await this.orchestrator.setPriority(
      ctx,
      actor,
      id,
      dto.reason,
      ifMatch,
      idem,
    );
    return ResponseWrapper.success(data, 'Urgent priority set');
  }

  /** The doctor forgot to press Complete. */
  @Can('queue.doctor.any')
  @Patch('entries/:id/force-complete')
  async forceComplete(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @IfMatch() ifMatch: number | undefined,
    @Idempotency() idem: IdempotencyInput,
  ) {
    const data = await this.orchestrator.complete(
      ctx,
      actor,
      id,
      ifMatch,
      idem,
      true,
    );
    return ResponseWrapper.success(data, 'Consultation completed');
  }

  // ─── Settings ──────────────────────────────────────────────────

  @AnyMember()
  @Get('policies')
  async getPolicies(@ActiveTenant() ctx: TenantContext) {
    return ResponseWrapper.success(
      await this.policies.getForLocation(ctx.organizationId, ctx.locationId),
      'Queue settings retrieved',
    );
  }

  @Can('admin.settings.manage')
  @Patch('policies')
  async updatePolicies(
    @Body() dto: UpdateQueuePolicyDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    await this.policies.upsert(ctx.organizationId, ctx.locationId, dto);
    return ResponseWrapper.success(
      await this.policies.getForLocation(ctx.organizationId, ctx.locationId),
      "Queue settings saved — they apply from tomorrow's queues",
    );
  }

  /** Drop this location's override; the organization default applies again. */
  @Can('admin.settings.manage')
  @Delete('policies/location')
  async removeOverride(@ActiveTenant() ctx: TenantContext) {
    await this.policies.removeOverride(ctx.organizationId, ctx.locationId);
    return ResponseWrapper.success(
      await this.policies.getForLocation(ctx.organizationId, ctx.locationId),
      'Location override removed',
    );
  }
}
