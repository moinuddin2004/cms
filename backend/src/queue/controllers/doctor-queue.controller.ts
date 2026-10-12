import {
  Body,
  Controller,
  Get,
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
import { Actor, AppRole } from 'src/common/enums/app-role.enum';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import {
  QueueOrchestrator,
  IdempotencyInput,
} from '../services/queue-orchestrator.service';
import { QueueQueryService } from '../services/queue-query.service';
import { Idempotency, IfMatch } from '../decorators/queue-request.decorators';
import {
  CloseSessionDto,
  ReasonDto,
  RequiredReasonDto,
  SelectPatientDto,
  SessionModeDto,
} from '../dto/queue.dto';
import { QueueErrors } from '../queue.errors';

const CLINICIAN = [AppRole.DOCTOR, AppRole.CLINIC_ADMIN];

/**
 * Doctor side of the queue. Besides the role, the orchestrator checks that
 * the session belongs to the signed-in doctor (clinic admins excepted).
 */
@RequireFeature('appointments.core')
@Controller('queue')
export class DoctorQueueController {
  constructor(
    private readonly orchestrator: QueueOrchestrator,
    private readonly query: QueueQueryService,
  ) {}

  /**
   * A doctor's queue for today (created if it doesn't exist yet). Doctors get
   * their own; a clinic admin names the doctor with `?doctorId=` to run that
   * queue on their behalf.
   */
  @Roles(AppRole.DOCTOR)
  @Get('my-session')
  async mySession(
    @Query('doctorId') requestedDoctorId: string | undefined,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
  ) {
    const isAdmin = actor.roles.includes(AppRole.CLINIC_ADMIN);
    if (
      requestedDoctorId &&
      requestedDoctorId !== actor.employeeId &&
      !isAdmin
    ) {
      throw QueueErrors.forbidden(
        "Only a clinic admin can open another doctor's queue",
      );
    }
    const doctorId = requestedDoctorId || actor.employeeId;
    if (!doctorId) {
      throw QueueErrors.notFound(
        'Doctor profile for this user at this location',
      );
    }
    const { sessionId } = await this.orchestrator.ensureTodaySession(
      ctx,
      actor,
      doctorId,
    );
    return ResponseWrapper.success(
      await this.query.snapshot(ctx, sessionId),
      'Your queue',
    );
  }

  // ─── Session ───────────────────────────────────────────────────

  @Roles(...CLINICIAN)
  @Patch('sessions/:id/start')
  async start(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.startSession(ctx, actor, id, idem),
      'Queue started',
    );
  }

  @Roles(...CLINICIAN)
  @Patch('sessions/:id/pause')
  async pause(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequiredReasonDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.pauseSession(ctx, actor, id, dto.reason, idem),
      'Queue paused',
    );
  }

  @Roles(...CLINICIAN)
  @Patch('sessions/:id/resume')
  async resume(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.resumeSession(ctx, actor, id, idem),
      'Queue resumed',
    );
  }

  @Roles(...CLINICIAN)
  @Patch('sessions/:id/close')
  async close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseSessionDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.closeSession(ctx, actor, id, dto, idem),
      'Queue closed',
    );
  }

  /** Switch smart/FIFO for today's session only (admin). */
  @Roles(AppRole.CLINIC_ADMIN)
  @Patch('sessions/:id/mode')
  async mode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SessionModeDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.setMode(
        ctx,
        actor,
        id,
        dto.smartQueueEnabled,
        idem,
      ),
      'Queue mode changed',
    );
  }

  // ─── Calling ───────────────────────────────────────────────────

  @Roles(...CLINICIAN)
  @Post('sessions/:id/call-next')
  async callNext(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    const data = await this.orchestrator.callNext(ctx, actor, id, idem);
    return ResponseWrapper.success(
      data,
      data.entry ? `Calling ${data.entry.token}` : 'No patient is waiting',
    );
  }

  @Roles(...CLINICIAN)
  @Patch('entries/:id/select')
  async select(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SelectPatientDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
    @IfMatch() ifMatch: number | undefined,
    @Idempotency() idem: IdempotencyInput,
  ) {
    const data = await this.orchestrator.selectPatient(
      ctx,
      actor,
      id,
      dto.reason,
      ifMatch,
      idem,
    );
    return ResponseWrapper.success(data, `Calling ${data.entry.token}`);
  }

  @Roles(...CLINICIAN)
  @Patch('entries/:id/recall')
  async recall(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.recall(ctx, actor, id, idem),
      'Called again',
    );
  }

  @Roles(...CLINICIAN)
  @Patch('entries/:id/undo-call')
  async undoCall(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
    @IfMatch() ifMatch: number | undefined,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.undoCall(ctx, actor, id, ifMatch, idem),
      'Call undone',
    );
  }

  /** Called patient didn't come. Reception may skip too. */
  @Roles(AppRole.DOCTOR, AppRole.RECEPTIONIST, AppRole.CLINIC_ADMIN)
  @Patch('entries/:id/skip')
  async skip(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
    @IfMatch() ifMatch: number | undefined,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.skip(ctx, actor, id, ifMatch, idem),
      'Skipped',
    );
  }

  // ─── Consultation ──────────────────────────────────────────────

  @Roles(...CLINICIAN)
  @Patch('entries/:id/start-consultation')
  async startConsultation(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
    @IfMatch() ifMatch: number | undefined,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.startConsultation(ctx, actor, id, ifMatch, idem),
      'Consultation started',
    );
  }

  @Roles(...CLINICIAN)
  @Patch('entries/:id/send-for-test')
  async sendForTest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
    @IfMatch() ifMatch: number | undefined,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.sendForTest(
        ctx,
        actor,
        id,
        dto.reason,
        ifMatch,
        idem,
      ),
      'Sent for test',
    );
  }

  @Roles(...CLINICIAN)
  @Patch('entries/:id/complete')
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
    @IfMatch() ifMatch: number | undefined,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.complete(ctx, actor, id, ifMatch, idem),
      'Consultation completed',
    );
  }

  @Roles(...CLINICIAN)
  @Patch('entries/:id/abort')
  async abort(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
    @IfMatch() ifMatch: number | undefined,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.abort(ctx, actor, id, dto.reason, ifMatch, idem),
      'Consultation stopped',
    );
  }
}
