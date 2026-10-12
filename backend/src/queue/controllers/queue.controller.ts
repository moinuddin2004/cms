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
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { CurrentActor, Roles } from 'src/common/decorators/roles.decorator';
import { Actor, ALL_APP_ROLES, AppRole } from 'src/common/enums/app-role.enum';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import {
  QueueOrchestrator,
  IdempotencyInput,
} from '../services/queue-orchestrator.service';
import { QueueQueryService } from '../services/queue-query.service';
import { QueuePoliciesService } from '../services/queue-policies.service';
import { Idempotency, IfMatch } from '../decorators/queue-request.decorators';
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

const RECEPTION = [AppRole.RECEPTIONIST, AppRole.CLINIC_ADMIN];
const ANY_STAFF = [AppRole.RECEPTIONIST, AppRole.DOCTOR, AppRole.CLINIC_ADMIN];

/**
 * Reception side of the queue, plus reads and settings. Every mutation goes
 * through QueueOrchestrator and needs an Idempotency-Key header; actions on
 * one entry accept `If-Match: <version>`.
 */
@RequireFeature('appointments.core')
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
  @Roles(...ALL_APP_ROLES)
  @Get('me')
  me(@CurrentActor() actor: Actor) {
    return ResponseWrapper.success(
      { roles: actor.roles, employeeId: actor.employeeId },
      'Your queue roles',
    );
  }

  /** Reception board: every doctor's lane for a service date (default today). */
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

  @Get('sessions/:id')
  async snapshot(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    return ResponseWrapper.success(
      await this.query.snapshot(ctx, id),
      'Queue retrieved',
    );
  }

  /** What Call Next would pick now; reserves nothing. */
  @Get('sessions/:id/next-preview')
  async nextPreview(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const snap = await this.query.snapshot(ctx, id);
    return ResponseWrapper.success(
      {
        suggestion: snap.suggestion,
        waitingOrder: snap.waitingOrder,
        eventSeq: snap.session.eventSeq,
      },
      'Next patient preview',
    );
  }

  @Roles(AppRole.CLINIC_ADMIN)
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

  @Get('entries/:id/ticket')
  async ticket(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    return ResponseWrapper.success(
      await this.query.ticket(ctx, id),
      'Ticket retrieved',
    );
  }

  /** A patient's visits — booked and walk-in — for the patient record. */
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

  @Roles(...RECEPTION)
  @Post('walk-ins')
  @HttpCode(HttpStatus.CREATED)
  async walkIn(
    @Body() dto: WalkInDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    const data = await this.orchestrator.registerWalkIn(ctx, actor, dto, idem);
    return ResponseWrapper.success(data, `Walk-in added — token ${data.token}`);
  }

  /** Make sure a doctor's session exists today (opens an empty lane). */
  @Roles(...ANY_STAFF)
  @Post('sessions')
  async ensureSession(
    @Body() dto: EnsureSessionDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
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

  @Roles(...RECEPTION)
  @Patch('entries/:id/cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
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

  @Roles(...RECEPTION)
  @Patch('entries/:id/rejoin')
  async rejoin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejoinDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
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

  @Roles(...RECEPTION)
  @Patch('entries/:id/return-from-test')
  async returnFromTest(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
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

  @Roles(...ANY_STAFF)
  @Patch('entries/:id/transfer')
  async transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
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

  /** Emergency priority: clinic admins only, reason required. */
  @Roles(AppRole.CLINIC_ADMIN)
  @Patch('entries/:id/priority')
  async priority(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequiredReasonDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
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
  @Roles(AppRole.CLINIC_ADMIN)
  @Patch('entries/:id/force-complete')
  async forceComplete(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
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

  @Get('policies')
  async getPolicies(@ActiveTenant() ctx: TenantContext) {
    return ResponseWrapper.success(
      await this.policies.getForLocation(ctx.organizationId, ctx.locationId),
      'Queue settings retrieved',
    );
  }

  @Roles(AppRole.CLINIC_ADMIN)
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
  @Roles(AppRole.CLINIC_ADMIN)
  @Delete('policies/location')
  async removeOverride(@ActiveTenant() ctx: TenantContext) {
    await this.policies.removeOverride(ctx.organizationId, ctx.locationId);
    return ResponseWrapper.success(
      await this.policies.getForLocation(ctx.organizationId, ctx.locationId),
      'Location override removed',
    );
  }
}
