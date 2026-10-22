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
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { AnyMember, Can } from 'src/access/decorators/access.decorators';
import {
  QueueOrchestrator,
  IdempotencyInput,
} from '../services/queue-orchestrator.service';
import { QueueQueryService } from '../services/queue-query.service';
import {
  CurrentQueueActor,
  Idempotency,
  IfMatch,
} from '../decorators/queue-request.decorators';
import {
  CloseSessionDto,
  ReasonDto,
  RequiredReasonDto,
  SelectPatientDto,
  SessionModeDto,
} from '../dto/queue.dto';
import { QueueErrors } from '../queue.errors';
import { QueueActor } from '../queue-actor';

/**
 * Doctor side of the queue. `queue.doctor.own` opens the doctor screen; the
 * orchestrator then checks the session is the signed-in doctor's own unless
 * they hold `queue.doctor.any`.
 */
@Controller('queue')
export class DoctorQueueController {
  constructor(
    private readonly orchestrator: QueueOrchestrator,
    private readonly query: QueueQueryService,
  ) {}

  /**
   * A doctor's queue for today (created if it doesn't exist yet). Doctors get
   * their own; staff with `queue.doctor.any` name the doctor with
   * `?doctorId=` to run that queue on their behalf.
   */
  @Can('queue.doctor.own')
  @Get('my-session')
  async mySession(
    @Query('doctorId') requestedDoctorId: string | undefined,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
  ) {
    if (
      requestedDoctorId &&
      requestedDoctorId !== actor.employeeId &&
      !actor.anyDoctor
    ) {
      throw QueueErrors.forbidden(
        'You can only open your own queue (needs queue.doctor.any)',
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

  @Can('queue.doctor.own')
  @Patch('sessions/:id/start')
  async start(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.startSession(ctx, actor, id, idem),
      'Queue started',
    );
  }

  @Can('queue.doctor.own')
  @Patch('sessions/:id/pause')
  async pause(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequiredReasonDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.pauseSession(ctx, actor, id, dto.reason, idem),
      'Queue paused',
    );
  }

  @Can('queue.doctor.own')
  @Patch('sessions/:id/resume')
  async resume(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.resumeSession(ctx, actor, id, idem),
      'Queue resumed',
    );
  }

  @Can('queue.doctor.own')
  @Patch('sessions/:id/close')
  async close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseSessionDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.closeSession(ctx, actor, id, dto, idem),
      'Queue closed',
    );
  }

  /** Switch smart/FIFO for today's session only. */
  @Can('queue.entry.reprioritize')
  @Patch('sessions/:id/mode')
  async mode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SessionModeDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
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

  @Can('queue.doctor.own')
  @Post('sessions/:id/call-next')
  async callNext(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    const data = await this.orchestrator.callNext(ctx, actor, id, idem);
    return ResponseWrapper.success(
      data,
      data.entry ? `Calling ${data.entry.token}` : 'No patient is waiting',
    );
  }

  @Can('queue.doctor.own')
  @Patch('entries/:id/select')
  async select(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SelectPatientDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
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

  @Can('queue.doctor.own')
  @Patch('entries/:id/recall')
  async recall(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.recall(ctx, actor, id, idem),
      'Called again',
    );
  }

  @Can('queue.doctor.own')
  @Patch('entries/:id/undo-call')
  async undoCall(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @IfMatch() ifMatch: number | undefined,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.undoCall(ctx, actor, id, ifMatch, idem),
      'Call undone',
    );
  }

  /**
   * Called patient didn't come: reception (`queue.entry.manage`) anywhere,
   * a doctor in their own session — the orchestrator checks which.
   */
  @AnyMember()
  @Patch('entries/:id/skip')
  async skip(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @IfMatch() ifMatch: number | undefined,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.skip(ctx, actor, id, ifMatch, idem),
      'Skipped',
    );
  }

  // ─── Consultation ──────────────────────────────────────────────

  @Can('queue.doctor.own')
  @Patch('entries/:id/start-consultation')
  async startConsultation(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @IfMatch() ifMatch: number | undefined,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.startConsultation(ctx, actor, id, ifMatch, idem),
      'Consultation started',
    );
  }

  @Can('queue.doctor.own')
  @Patch('entries/:id/send-for-test')
  async sendForTest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
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

  @Can('queue.doctor.own')
  @Patch('entries/:id/complete')
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @IfMatch() ifMatch: number | undefined,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.complete(ctx, actor, id, ifMatch, idem),
      'Consultation completed',
    );
  }

  @Can('queue.doctor.own')
  @Patch('entries/:id/abort')
  async abort(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @IfMatch() ifMatch: number | undefined,
    @Idempotency() idem: IdempotencyInput,
  ) {
    return ResponseWrapper.success(
      await this.orchestrator.abort(ctx, actor, id, dto.reason, ifMatch, idem),
      'Consultation stopped',
    );
  }
}
