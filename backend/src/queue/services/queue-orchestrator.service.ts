import { HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, QueryFailedError } from 'typeorm';
import { QueueSession } from '../entities/queue-session.entity';
import { QueueEntry } from '../entities/queue-entry.entity';
import {
  ACTIVE_ENTRY_STATUSES,
  EntryStatus,
  PriorityClass,
  QueueType,
  RejoinPolicy,
  SelectionReason,
  SessionStatus,
  WITH_DOCTOR_STATUSES,
} from '../enums/queue.enums';
import {
  assertEntryTransition,
  assertSessionTransition,
  CHECK_IN_SESSION_STATUSES,
} from '../queue-transitions';
import { QueueErrors } from '../queue.errors';
import { selectNext } from '../engines/selection-engine';
import { isBeyondMaxLate } from '../engines/check-in-rules';
import { TokenEngine } from './token-engine.service';
import {
  EffectivePolicy,
  QueuePoliciesService,
} from './queue-policies.service';
import { EntryView, QueueQueryService } from './queue-query.service';
import { EncountersService } from 'src/encounters/encounters.service';
import { Appointment } from 'src/appointments/entities/appointment.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { AppointmentStatus } from 'src/common/enums/appointment-status.enum';
import { CancelReason } from 'src/appointments/enums/cancel-reason.enum';
import { assertTransition as assertAppointmentTransition } from 'src/appointments/appointment-transitions';
import { Actor, AppRole } from 'src/common/enums/app-role.enum';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import {
  CheckInDto,
  CloseSessionDto,
  RejoinDto,
  TransferDto,
  WalkInDto,
} from '../dto/queue.dto';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { pgError, sqlRows } from 'src/common/database/sql';

/** Actor used by background jobs (no user). */
export const SYSTEM_ACTOR: Actor = {
  userId: '00000000-0000-0000-0000-000000000000',
  roles: [],
  employeeId: null,
};

export type IdempotencyInput = { key: string; hash: string } | null;

/** Column values for an entry UPDATE; always bumps the optimistic-lock version. */
function entryPatch(
  patch: Partial<Omit<QueueEntry, 'session' | 'patient' | 'appointment'>>,
): QueryDeepPartialEntity<QueueEntry> {
  return { ...patch, version: () => 'version + 1' };
}

/** Column values for a session UPDATE; always bumps the version. */
function sessionPatch(
  patch: Partial<Omit<QueueSession, 'doctor' | 'entries'>>,
): QueryDeepPartialEntity<QueueSession> {
  return { ...patch, version: () => 'version + 1' };
}

interface EventInput {
  entry?: QueueEntry | null;
  eventType: string;
  from?: EntryStatus | null;
  to?: EntryStatus | null;
  reasonCode?: string | null;
  reasonText?: string | null;
  suggestedEntryId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * One transaction's worth of queue work: the session lock, entry updates
 * checked against the transition map, and audit + outbox rows — all
 * committed together or not at all.
 */
class QueueTx {
  constructor(
    readonly manager: EntityManager,
    readonly now: Date,
    readonly ctx: TenantContext,
    readonly actor: Actor,
  ) {}

  get actorRole(): string {
    return this.actor === SYSTEM_ACTOR
      ? 'system'
      : this.actor.roles.join(',') || 'member';
  }

  /** Lock order rule: always the session first, then its entries. */
  async lockSession(sessionId: string): Promise<QueueSession> {
    const session = await this.manager
      .getRepository(QueueSession)
      .createQueryBuilder('s')
      .setLock('pessimistic_write')
      .where('s.id = :sessionId', { sessionId })
      .andWhere('s.organization_id = :org', { org: this.ctx.organizationId })
      .andWhere('s.location_id = :loc', { loc: this.ctx.locationId })
      .getOne();
    if (!session) throw QueueErrors.notFound('Queue session');
    return session;
  }

  /** Lock the entry's session, then read the entry fresh under that lock. */
  async lockEntry(
    entryId: string,
  ): Promise<{ entry: QueueEntry; session: QueueSession }> {
    const ref = await this.manager.getRepository(QueueEntry).findOne({
      where: { id: entryId, organizationId: this.ctx.organizationId },
      select: { id: true, queueSessionId: true },
    });
    if (!ref) throw QueueErrors.notFound('Queue entry');
    const session = await this.lockSession(ref.queueSessionId);
    const entry = await this.loadEntry(entryId);
    return { entry, session };
  }

  async loadEntry(entryId: string): Promise<QueueEntry> {
    const entry = await this.manager.getRepository(QueueEntry).findOne({
      where: { id: entryId },
      relations: { patient: true, appointment: true },
    });
    if (!entry) throw QueueErrors.notFound('Queue entry');
    return entry;
  }

  async sessionEntries(
    sessionId: string,
    statuses?: EntryStatus[],
  ): Promise<QueueEntry[]> {
    return this.manager.getRepository(QueueEntry).find({
      where: {
        queueSessionId: sessionId,
        ...(statuses ? { status: In(statuses) } : {}),
      },
      relations: { patient: true, appointment: true },
    });
  }

  /**
   * Move an entry to `to`. Checks the transition map and (optionally) the
   * client's If-Match version; the UPDATE also re-checks the old status as a
   * defensive guard. Writes the audit event + outbox in the same transaction.
   */
  async transition(
    session: QueueSession,
    entry: QueueEntry,
    to: EntryStatus,
    patch: Partial<QueueEntry>,
    event: Omit<EventInput, 'entry' | 'from' | 'to'>,
    ifMatch?: number,
  ): Promise<void> {
    assertEntryTransition(entry.status, to);
    if (ifMatch !== undefined && ifMatch !== entry.version) {
      throw QueueErrors.versionConflict({
        id: entry.id,
        status: entry.status,
        version: entry.version,
      });
    }
    const from = entry.status;
    const result = await this.manager
      .createQueryBuilder()
      .update(QueueEntry)
      .set(entryPatch({ ...patch, status: to }))
      .where('id = :id AND status = :from', { id: entry.id, from })
      .execute();
    if (!result.affected) {
      throw QueueErrors.versionConflict({ id: entry.id });
    }
    Object.assign(entry, patch, { status: to, version: entry.version + 1 });
    await this.emit(session, { ...event, entry, from, to });
  }

  /**
   * Audit event + outbox messages; bumps the session's event_seq. Two round
   * trips: the seq bump, then one statement that writes the event, the three
   * outbox rows and the NOTIFY that wakes the relay (delivered on commit).
   */
  async emit(session: QueueSession, e: EventInput): Promise<number> {
    const [bumped] = await sqlRows<{ event_seq: string }>(
      this.manager,
      `UPDATE queue_sessions SET event_seq = event_seq + 1 WHERE id = $1 RETURNING event_seq`,
      [session.id],
    );
    const seq = Number(bumped.event_seq);
    session.eventSeq = String(seq);

    // Realtime nudges. Payloads carry ids, statuses and tokens — never
    // patient names — so the display room can share them safely.
    const base = {
      sessionId: session.id,
      seq,
      eventType: e.eventType,
      entryId: e.entry?.id ?? null,
      fromStatus: e.from ?? null,
      toStatus: e.to ?? null,
      occurredAt: this.now.toISOString(),
    };
    const boardPayload = JSON.stringify({ type: 'queue.event', ...base });
    const displayPayload = JSON.stringify({
      type: 'display.event',
      sessionId: session.id,
      seq,
      eventType: e.eventType,
    });

    await sqlRows(
      this.manager,
      `WITH ev AS (
         INSERT INTO queue_events
           (organization_id, queue_session_id, queue_entry_id, seq, event_type,
            from_status, to_status, reason_code, reason_text, suggested_entry_id,
            actor_id, actor_role, metadata, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ), ob AS (
         INSERT INTO outbox (organization_id, topic, payload)
         VALUES ($1, $15, $16), ($1, $17, $16), ($1, $18, $19)
       )
       SELECT pg_notify('queue_outbox', '')`,
      [
        session.organizationId,
        session.id,
        e.entry?.id ?? null,
        seq,
        e.eventType,
        e.from ?? null,
        e.to ?? null,
        e.reasonCode ?? null,
        e.reasonText ?? null,
        e.suggestedEntryId ?? null,
        this.actor.userId,
        this.actorRole,
        JSON.stringify(e.metadata ?? {}),
        this.now,
        `session:${session.id}`,
        boardPayload,
        `location:${session.locationId}:board`,
        `location:${session.locationId}:display`,
        displayPayload,
      ],
    );
    return seq;
  }
}

/**
 * QueueOrchestrator — the ONLY way queue state changes.
 *
 * Every mutation: BEGIN → SET LOCAL tenant + lock_timeout → claim the
 * Idempotency-Key → lock the doctor's session row (FOR UPDATE) → check the
 * transition map → run the engines → update → audit event + outbox → save
 * the response under the key → COMMIT. The partial unique indexes on
 * queue_entries are the last line of defence if code ever slips.
 */
@Injectable()
export class QueueOrchestrator {
  private readonly logger = new Logger(QueueOrchestrator.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tokens: TokenEngine,
    private readonly policies: QueuePoliciesService,
    private readonly query: QueueQueryService,
    private readonly encounters: EncountersService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // ARRIVALS — the only places a token is issued
  // ═══════════════════════════════════════════════════════════

  /** Booked patient arrives: token in the appointment doctor's session. */
  async checkInAppointment(
    ctx: TenantContext,
    actor: Actor,
    appointmentId: string,
    dto: CheckInDto,
    idem: IdempotencyInput,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const appt = await tx.manager
        .getRepository(Appointment)
        .createQueryBuilder('a')
        .setLock('pessimistic_write')
        .where(
          'a.id = :id AND a.location_id = :loc AND a.organization_id = :org',
          {
            id: appointmentId,
            loc: ctx.locationId,
            org: ctx.organizationId,
          },
        )
        .getOne();
      if (!appt) throw QueueErrors.notFound('Appointment');

      const policy = await this.policies.getEffective(
        ctx.organizationId,
        ctx.locationId,
      );
      const today = this.policies.serviceDate(policy, tx.now);

      // Duplicate check-in / retry without the key → hand back the same entry.
      const active = await tx.manager.getRepository(QueueEntry).findOne({
        where: { appointmentId: appt.id, status: In(ACTIVE_ENTRY_STATUSES) },
        relations: { patient: true, appointment: true, session: true },
      });
      if (active) {
        throw QueueErrors.alreadyCheckedIn(
          this.query.toEntryView(active, active.session.tokenPrefix),
        );
      }

      if (appt.status === AppointmentStatus.NO_SHOW) {
        throw QueueErrors.lateLimitExceeded(policy.maxLateMin);
      }
      assertAppointmentTransition(appt.status, AppointmentStatus.CHECKED_IN);
      if (this.policies.serviceDate(policy, appt.startTime) !== today) {
        throw QueueErrors.notToday();
      }
      if (isBeyondMaxLate(appt.startTime, tx.now, policy.maxLateMin)) {
        throw QueueErrors.lateLimitExceeded(policy.maxLateMin);
      }

      const session = await this.openSessionForArrival(
        tx,
        policy,
        appt.doctorId,
        today,
      );
      const entry = await this.issueToken(tx, session, {
        patientId: appt.patientId,
        appointmentId: appt.id,
        queueType: QueueType.APPOINTMENT,
        reasonForVisit: appt.reasonForVisit,
        urgentReason: dto.urgentReason,
      });

      await tx.manager.update(
        Appointment,
        { id: appt.id },
        {
          status: AppointmentStatus.CHECKED_IN,
          checkedInAt: tx.now,
          updatedBy: actor.userId,
        },
      );

      return this.arrivalResult(tx, session, entry);
    });
  }

  /** Walk-in registration: straight into the chosen doctor's queue (FIFO). */
  async registerWalkIn(
    ctx: TenantContext,
    actor: Actor,
    dto: WalkInDto,
    idem: IdempotencyInput,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      await this.assertDoctorAtLocation(tx, dto.doctorId);
      const patientId = await this.resolvePatient(tx, dto);
      const policy = await this.policies.getEffective(
        ctx.organizationId,
        ctx.locationId,
      );
      const today = this.policies.serviceDate(policy, tx.now);

      const session = await this.openSessionForArrival(
        tx,
        policy,
        dto.doctorId,
        today,
      );

      // Same doctor's queue already has them → show that token, don't add.
      const sameQueue = await tx.manager.getRepository(QueueEntry).findOne({
        where: {
          queueSessionId: session.id,
          patientId,
          status: In(ACTIVE_ENTRY_STATUSES),
        },
        relations: { patient: true, appointment: true },
      });
      if (sameQueue) {
        throw QueueErrors.alreadyCheckedIn(
          this.query.toEntryView(sameQueue, session.tokenPrefix),
        );
      }

      // Another doctor's queue today → allowed only after the desk confirms.
      if (!dto.force) {
        const elsewhere = await tx.manager
          .getRepository(QueueEntry)
          .createQueryBuilder('e')
          .innerJoinAndSelect('e.session', 's')
          .leftJoinAndSelect('s.doctor', 'd')
          .where('e.patient_id = :patientId', { patientId })
          .andWhere('e.status IN (:...active)', {
            active: ACTIVE_ENTRY_STATUSES,
          })
          .andWhere('s.location_id = :loc AND s.service_date = :today', {
            loc: ctx.locationId,
            today,
          })
          .getMany();
        if (elsewhere.length) {
          throw QueueErrors.activeElsewhere(
            elsewhere.map((e) => ({
              entryId: e.id,
              token: this.tokens.format(e.session.tokenPrefix, e.tokenNumber),
              doctorName: e.session.doctor?.fullName ?? null,
              status: e.status,
            })),
          );
        }
      }

      const entry = await this.issueToken(tx, session, {
        patientId,
        appointmentId: null,
        queueType: QueueType.WALK_IN,
        reasonForVisit: dto.reasonForVisit ?? null,
        urgentReason: dto.urgentReason,
      });
      return this.arrivalResult(tx, session, entry);
    });
  }

  /**
   * Patient came after max_late_min: the appointment stays/becomes NO_SHOW
   * and a new walk-in entry (new token) is linked to it.
   */
  async convertToWalkIn(
    ctx: TenantContext,
    actor: Actor,
    appointmentId: string,
    dto: CheckInDto,
    idem: IdempotencyInput,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const appt = await tx.manager
        .getRepository(Appointment)
        .createQueryBuilder('a')
        .setLock('pessimistic_write')
        .where(
          'a.id = :id AND a.location_id = :loc AND a.organization_id = :org',
          {
            id: appointmentId,
            loc: ctx.locationId,
            org: ctx.organizationId,
          },
        )
        .getOne();
      if (!appt) throw QueueErrors.notFound('Appointment');

      const policy = await this.policies.getEffective(
        ctx.organizationId,
        ctx.locationId,
      );
      const late = isBeyondMaxLate(appt.startTime, tx.now, policy.maxLateMin);
      const convertible =
        appt.status === AppointmentStatus.NO_SHOW ||
        ((appt.status === AppointmentStatus.SCHEDULED ||
          appt.status === AppointmentStatus.CONFIRMED) &&
          late);
      if (!convertible) {
        throw QueueErrors.invalidTransition(
          'Only an appointment past the late limit (or a no-show) can be converted; check the patient in instead',
        );
      }

      if (appt.status !== AppointmentStatus.NO_SHOW) {
        await tx.manager.update(
          Appointment,
          { id: appt.id },
          {
            status: AppointmentStatus.NO_SHOW,
            noShowAt: tx.now,
            updatedBy: actor.userId,
          },
        );
      }

      const today = this.policies.serviceDate(policy, tx.now);
      const session = await this.openSessionForArrival(
        tx,
        policy,
        appt.doctorId,
        today,
      );
      const existing = await tx.manager.getRepository(QueueEntry).findOne({
        where: {
          queueSessionId: session.id,
          patientId: appt.patientId,
          status: In(ACTIVE_ENTRY_STATUSES),
        },
        relations: { patient: true, appointment: true },
      });
      if (existing) {
        throw QueueErrors.alreadyCheckedIn(
          this.query.toEntryView(existing, session.tokenPrefix),
        );
      }

      const entry = await this.issueToken(tx, session, {
        patientId: appt.patientId,
        appointmentId: null,
        queueType: QueueType.WALK_IN,
        reasonForVisit: appt.reasonForVisit,
        urgentReason: dto.urgentReason,
        convertedFromApptId: appt.id,
      });
      return this.arrivalResult(tx, session, entry);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // DOCTOR — Call Next / Select / consultation
  // ═══════════════════════════════════════════════════════════

  async callNext(
    ctx: TenantContext,
    actor: Actor,
    sessionId: string,
    idem: IdempotencyInput,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const session = await tx.lockSession(sessionId);
      this.assertSessionDoctor(actor, session);
      this.assertOpen(session);
      await this.assertDoctorFree(tx, session);

      const policy = await this.policies.getEffective(
        ctx.organizationId,
        ctx.locationId,
      );
      const waiting = await tx.sessionEntries(session.id, [
        EntryStatus.WAITING,
      ]);
      const decision = selectNext(
        waiting.map((e) => this.query.toCandidate(e)),
        tx.now,
        this.enginePolicy(session, policy),
        session.lastCallReason,
      );
      if (!decision) {
        return {
          entry: null,
          reason: 'NO_ELIGIBLE_PATIENT',
          eventSeq: Number(session.eventSeq),
        };
      }

      const entry = waiting.find((e) => e.id === decision.entryId)!;
      await this.setLastCallReason(tx, session, decision.reason);
      await tx.transition(
        session,
        entry,
        EntryStatus.CALLED,
        { calledAt: tx.now },
        { eventType: 'CALLED', reasonCode: decision.reason },
      );
      return {
        entry: this.query.toEntryView(entry, session.tokenPrefix),
        reason: decision.reason,
        eventSeq: Number(session.eventSeq),
      };
    });
  }

  /** Doctor picks a specific waiting patient; the engine's pick is audited too. */
  async selectPatient(
    ctx: TenantContext,
    actor: Actor,
    entryId: string,
    reasonText: string | undefined,
    ifMatch: number | undefined,
    idem: IdempotencyInput,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const { entry, session } = await tx.lockEntry(entryId);
      this.assertSessionDoctor(actor, session);
      this.assertOpen(session);
      await this.assertDoctorFree(tx, session);

      const policy = await this.policies.getEffective(
        ctx.organizationId,
        ctx.locationId,
      );
      if (policy.manualSelectReasonRequired && !reasonText?.trim()) {
        throw QueueErrors.reasonRequired('select a patient out of order');
      }
      const waiting = await tx.sessionEntries(session.id, [
        EntryStatus.WAITING,
      ]);
      const suggestion = selectNext(
        waiting.map((e) => this.query.toCandidate(e)),
        tx.now,
        this.enginePolicy(session, policy),
        session.lastCallReason,
      );

      await this.setLastCallReason(tx, session, 'MANUAL_SELECT');
      await tx.transition(
        session,
        entry,
        EntryStatus.CALLED,
        { calledAt: tx.now },
        {
          eventType: 'CALLED',
          reasonCode: 'MANUAL_SELECT',
          reasonText: reasonText?.trim() || null,
          suggestedEntryId: suggestion?.entryId ?? null,
        },
        ifMatch,
      );
      return {
        entry: this.query.toEntryView(entry, session.tokenPrefix),
        reason: 'MANUAL_SELECT' as SelectionReason,
        suggestedEntryId: suggestion?.entryId ?? null,
        eventSeq: Number(session.eventSeq),
      };
    });
  }

  /** Announce again; no state change. */
  async recall(
    ctx: TenantContext,
    actor: Actor,
    entryId: string,
    idem: IdempotencyInput,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const { entry, session } = await tx.lockEntry(entryId);
      this.assertSessionDoctor(actor, session);
      if (entry.status !== EntryStatus.CALLED) {
        throw QueueErrors.invalidTransition(
          'Only a called patient can be recalled',
        );
      }
      await tx.emit(session, {
        entry,
        eventType: 'RECALLED',
        from: entry.status,
        to: entry.status,
      });
      return this.entryResult(session, entry);
    });
  }

  /** Wrong call: back to WAITING, same position. */
  async undoCall(
    ctx: TenantContext,
    actor: Actor,
    entryId: string,
    ifMatch: number | undefined,
    idem: IdempotencyInput,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const { entry, session } = await tx.lockEntry(entryId);
      this.assertSessionDoctor(actor, session);
      await tx.transition(
        session,
        entry,
        EntryStatus.WAITING,
        { calledAt: null },
        { eventType: 'CALL_UNDONE' },
        ifMatch,
      );
      return this.entryResult(session, entry);
    });
  }

  /** Called patient did not come (doctor, reception, or the call-timeout job). */
  async skip(
    ctx: TenantContext,
    actor: Actor,
    entryId: string,
    ifMatch: number | undefined,
    idem: IdempotencyInput,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const { entry, session } = await tx.lockEntry(entryId);
      if (this.isDoctorOnly(actor)) this.assertSessionDoctor(actor, session);
      await tx.transition(
        session,
        entry,
        EntryStatus.SKIPPED,
        { skippedAt: tx.now },
        {
          eventType: 'SKIPPED',
          reasonCode: actor === SYSTEM_ACTOR ? 'CALL_TIMEOUT' : null,
        },
        ifMatch,
      );
      return this.entryResult(session, entry);
    });
  }

  async startConsultation(
    ctx: TenantContext,
    actor: Actor,
    entryId: string,
    ifMatch: number | undefined,
    idem: IdempotencyInput,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const { entry, session } = await tx.lockEntry(entryId);
      this.assertSessionDoctor(actor, session);
      await tx.transition(
        session,
        entry,
        EntryStatus.IN_CONSULTATION,
        { consultationStartedAt: tx.now },
        { eventType: 'CONSULTATION_STARTED' },
        ifMatch,
      );
      // The clinical record begins when the doctor actually starts.
      const encounter = await this.encounters.ensureForQueueEntry(
        tx.manager,
        entry,
        session.locationId,
        actor.userId,
      );
      return { ...this.entryResult(session, entry), encounterId: encounter.id };
    });
  }

  async sendForTest(
    ctx: TenantContext,
    actor: Actor,
    entryId: string,
    reason: string | undefined,
    ifMatch: number | undefined,
    idem: IdempotencyInput,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const { entry, session } = await tx.lockEntry(entryId);
      this.assertSessionDoctor(actor, session);
      await tx.transition(
        session,
        entry,
        EntryStatus.ON_HOLD,
        { holdStartedAt: tx.now },
        {
          eventType: 'SENT_FOR_TEST',
          reasonText: reason ?? null,
        },
        ifMatch,
      );
      return this.entryResult(session, entry);
    });
  }

  /** Back from lab/X-ray: same token, ahead of walk-ins (smart mode). */
  async returnFromTest(
    ctx: TenantContext,
    actor: Actor,
    entryId: string,
    ifMatch: number | undefined,
    idem: IdempotencyInput,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const { entry, session } = await tx.lockEntry(entryId);
      await tx.transition(
        session,
        entry,
        EntryStatus.WAITING,
        { returnedFromHoldAt: tx.now },
        {
          eventType: 'RETURNED_FROM_TEST',
        },
        ifMatch,
      );
      return this.entryResult(session, entry);
    });
  }

  async complete(
    ctx: TenantContext,
    actor: Actor,
    entryId: string,
    ifMatch: number | undefined,
    idem: IdempotencyInput,
    force = false,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const { entry, session } = await tx.lockEntry(entryId);
      if (!force) this.assertSessionDoctor(actor, session);
      await tx.transition(
        session,
        entry,
        EntryStatus.COMPLETED,
        { finishedAt: tx.now },
        {
          eventType: force ? 'FORCE_COMPLETED' : 'COMPLETED',
        },
        ifMatch,
      );
      if (entry.appointmentId) {
        await tx.manager.update(
          Appointment,
          { id: entry.appointmentId },
          {
            status: AppointmentStatus.COMPLETED,
            completedAt: tx.now,
            updatedBy: actor.userId,
          },
        );
      }
      return this.entryResult(session, entry);
    });
  }

  /** Consultation stopped half-way; the booking is closed as cancelled. */
  async abort(
    ctx: TenantContext,
    actor: Actor,
    entryId: string,
    reason: string | undefined,
    ifMatch: number | undefined,
    idem: IdempotencyInput,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const { entry, session } = await tx.lockEntry(entryId);
      this.assertSessionDoctor(actor, session);
      await tx.transition(
        session,
        entry,
        EntryStatus.ABORTED,
        { finishedAt: tx.now },
        {
          eventType: 'ABORTED',
          reasonText: reason ?? null,
        },
        ifMatch,
      );
      if (entry.appointmentId) {
        await this.closeAppointment(
          tx,
          entry.appointmentId,
          CancelReason.OTHER,
          reason ?? 'Consultation aborted',
        );
      }
      return this.entryResult(session, entry);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // RECEPTION — cancel, rejoin, transfer, priority
  // ═══════════════════════════════════════════════════════════

  /** Patient left: waiting / skipped / on-hold entry is cancelled; its token is never reissued. */
  async cancel(
    ctx: TenantContext,
    actor: Actor,
    entryId: string,
    reason: string | undefined,
    ifMatch: number | undefined,
    idem: IdempotencyInput,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const { entry, session } = await tx.lockEntry(entryId);
      await this.cancelEntry(tx, session, entry, reason, ifMatch);
      return this.entryResult(session, entry);
    });
  }

  async rejoin(
    ctx: TenantContext,
    actor: Actor,
    entryId: string,
    dto: RejoinDto,
    ifMatch: number | undefined,
    idem: IdempotencyInput,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const { entry, session } = await tx.lockEntry(entryId);
      const policy = await this.policies.getEffective(
        ctx.organizationId,
        ctx.locationId,
      );

      let sortAnchorAt = entry.sortAnchorAt;
      if (policy.skippedRejoinPolicy === RejoinPolicy.END) {
        sortAnchorAt = tx.now;
      } else if (
        policy.skippedRejoinPolicy === RejoinPolicy.MANUAL &&
        !dto.placeAfterEntryId
      ) {
        // Nothing to choose when nobody else is waiting: back of the (empty) line.
        const othersWaiting = await tx.manager.getRepository(QueueEntry).count({
          where: { queueSessionId: session.id, status: EntryStatus.WAITING },
        });
        if (othersWaiting) {
          throw QueueErrors.invalidTransition(
            'Choose where to place the patient (placeAfterEntryId)',
          );
        }
        sortAnchorAt = tx.now;
      } else if (policy.skippedRejoinPolicy === RejoinPolicy.MANUAL) {
        const after = await tx.manager.getRepository(QueueEntry).findOne({
          where: {
            id: dto.placeAfterEntryId,
            queueSessionId: session.id,
            status: EntryStatus.WAITING,
          },
        });
        if (!after) throw QueueErrors.notFound('Waiting entry to place after');
        sortAnchorAt = new Date(after.sortAnchorAt.getTime() + 1);
      }

      await tx.transition(
        session,
        entry,
        EntryStatus.WAITING,
        { sortAnchorAt, calledAt: null },
        {
          eventType: 'REJOINED',
          reasonCode: policy.skippedRejoinPolicy,
        },
        ifMatch,
      );
      return this.entryResult(session, entry);
    });
  }

  /**
   * Move a waiting (or in-consultation) patient to another doctor: a new
   * token in that doctor's session; the old entry becomes TRANSFERRED.
   */
  async transfer(
    ctx: TenantContext,
    actor: Actor,
    entryId: string,
    dto: TransferDto,
    ifMatch: number | undefined,
    idem: IdempotencyInput,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const ref = await tx.manager.getRepository(QueueEntry).findOne({
        where: { id: entryId, organizationId: ctx.organizationId },
        relations: { session: true },
      });
      if (!ref) throw QueueErrors.notFound('Queue entry');
      if (ref.session.doctorId === dto.toDoctorId) {
        throw QueueErrors.invalidTransition(
          "The patient is already in this doctor's queue",
        );
      }
      await this.assertDoctorAtLocation(tx, dto.toDoctorId);
      const policy = await this.policies.getEffective(
        ctx.organizationId,
        ctx.locationId,
      );
      const targetId = await this.tokens.ensureSession(tx.manager, {
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
        doctorId: dto.toDoctorId,
        serviceDate: ref.session.serviceDate,
        smartQueueEnabled: policy.smartQueueEnabled,
      });
      const moved = await this.transferEntry(
        tx,
        ref.queueSessionId,
        entryId,
        targetId,
        dto.reason,
        ifMatch,
      );
      return moved;
    });
  }

  /** Emergency priority — authorized staff only, reason required. */
  async setPriority(
    ctx: TenantContext,
    actor: Actor,
    entryId: string,
    reason: string,
    ifMatch: number | undefined,
    idem: IdempotencyInput,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const { entry, session } = await tx.lockEntry(entryId);
      if (
        ![
          EntryStatus.WAITING,
          EntryStatus.SKIPPED,
          EntryStatus.ON_HOLD,
        ].includes(entry.status)
      ) {
        throw QueueErrors.invalidTransition(
          'Priority can only be given to a patient who is still waiting',
        );
      }
      if (ifMatch !== undefined && ifMatch !== entry.version) {
        throw QueueErrors.versionConflict({
          id: entry.id,
          version: entry.version,
        });
      }
      await tx.manager
        .createQueryBuilder()
        .update(QueueEntry)
        .set({
          priorityClass: PriorityClass.AUTHORIZED_URGENT,
          urgentSince: entry.urgentSince ?? tx.now,
          urgentReason: reason,
          version: () => 'version + 1',
        })
        .where('id = :id', { id: entry.id })
        .execute();
      Object.assign(entry, {
        priorityClass: PriorityClass.AUTHORIZED_URGENT,
        urgentSince: entry.urgentSince ?? tx.now,
        urgentReason: reason,
        version: entry.version + 1,
      });
      await tx.emit(session, {
        entry,
        eventType: 'PRIORITY_SET',
        from: entry.status,
        to: entry.status,
        reasonText: reason,
      });
      return this.entryResult(session, entry);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SESSION — start / pause / resume / close / mode
  // ═══════════════════════════════════════════════════════════

  /** Make sure a doctor's session exists for today (doctor screen opens before any check-in). */
  async ensureTodaySession(ctx: TenantContext, actor: Actor, doctorId: string) {
    return this.mutate(ctx, actor, null, async (tx) => {
      await this.assertDoctorAtLocation(tx, doctorId);
      const policy = await this.policies.getEffective(
        ctx.organizationId,
        ctx.locationId,
      );
      const id = await this.tokens.ensureSession(tx.manager, {
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
        doctorId,
        serviceDate: this.policies.serviceDate(policy, tx.now),
        smartQueueEnabled: policy.smartQueueEnabled,
      });
      return { sessionId: id };
    });
  }

  async startSession(
    ctx: TenantContext,
    actor: Actor,
    sessionId: string,
    idem: IdempotencyInput,
  ) {
    return this.sessionChange(
      ctx,
      actor,
      sessionId,
      idem,
      SessionStatus.OPEN,
      'SESSION_STARTED',
      (s, now) => ({
        startedAt: s.startedAt ?? now,
        pauseReason: null,
      }),
    );
  }

  async pauseSession(
    ctx: TenantContext,
    actor: Actor,
    sessionId: string,
    reason: string,
    idem: IdempotencyInput,
  ) {
    return this.sessionChange(
      ctx,
      actor,
      sessionId,
      idem,
      SessionStatus.PAUSED,
      'SESSION_PAUSED',
      () => ({
        pauseReason: reason,
      }),
      reason,
    );
  }

  async resumeSession(
    ctx: TenantContext,
    actor: Actor,
    sessionId: string,
    idem: IdempotencyInput,
  ) {
    return this.sessionChange(
      ctx,
      actor,
      sessionId,
      idem,
      SessionStatus.OPEN,
      'SESSION_RESUMED',
      () => ({
        pauseReason: null,
      }),
    );
  }

  /**
   * End of day. Nobody may be with the doctor, and every waiting / skipped /
   * on-hold patient needs a decision (cancel or transfer) in the request.
   */
  async closeSession(
    ctx: TenantContext,
    actor: Actor,
    sessionId: string,
    dto: CloseSessionDto,
    idem: IdempotencyInput,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const session = await tx.lockSession(sessionId);
      if (actor !== SYSTEM_ACTOR) this.assertSessionDoctor(actor, session);
      assertSessionTransition(session.status, SessionStatus.CLOSED);
      await this.assertDoctorFree(tx, session);

      const remaining = await tx.sessionEntries(session.id, [
        EntryStatus.WAITING,
        EntryStatus.SKIPPED,
        EntryStatus.ON_HOLD,
      ]);
      const decisions = new Map(dto.decisions.map((d) => [d.entryId, d]));
      const undecided = remaining.filter((e) => !decisions.has(e.id));
      if (undecided.length) {
        throw QueueErrors.invalidTransition(
          'Decide (cancel or transfer) for every remaining patient before closing',
          {
            undecidedEntryIds: undecided.map((e) => e.id),
          },
        );
      }

      const policy = await this.policies.getEffective(
        ctx.organizationId,
        ctx.locationId,
      );
      for (const entry of remaining) {
        const d = decisions.get(entry.id)!;
        if (d.action === 'cancel') {
          await this.cancelEntry(tx, session, entry, 'Session closed');
        } else {
          if (entry.status !== EntryStatus.WAITING) {
            // Only waiting patients can move; bring skipped/on-hold back first.
            throw QueueErrors.invalidTransition(
              `Entry ${entry.id} is ${entry.status}; only waiting patients can be transferred`,
            );
          }
          const targetId = await this.tokens.ensureSession(tx.manager, {
            organizationId: ctx.organizationId,
            locationId: ctx.locationId,
            doctorId: d.toDoctorId!,
            serviceDate: session.serviceDate,
            smartQueueEnabled: policy.smartQueueEnabled,
          });
          await this.transferEntry(
            tx,
            session.id,
            entry.id,
            targetId,
            'Session closed',
          );
        }
      }

      await this.updateSession(tx, session, {
        status: SessionStatus.CLOSED,
        closedAt: tx.now,
      });
      await tx.emit(session, { eventType: 'SESSION_CLOSED' });
      return this.sessionResult(session);
    });
  }

  /** Admin switches smart/FIFO mode for one session of today. */
  async setMode(
    ctx: TenantContext,
    actor: Actor,
    sessionId: string,
    smartQueueEnabled: boolean,
    idem: IdempotencyInput,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const session = await tx.lockSession(sessionId);
      if (session.smartQueueEnabled === smartQueueEnabled)
        return this.sessionResult(session);
      await this.updateSession(tx, session, { smartQueueEnabled });
      await tx.emit(session, {
        eventType: 'MODE_CHANGED',
        metadata: { smartQueueEnabled },
      });
      return this.sessionResult(session);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // JOB HOOKS (system actor; each re-checks state under the lock)
  // ═══════════════════════════════════════════════════════════

  /** call-timeout: still the same CALLED version → SKIPPED. */
  async timeoutCall(
    ctx: TenantContext,
    entryId: string,
    expectedVersion: number,
  ) {
    try {
      return await this.skip(ctx, SYSTEM_ACTOR, entryId, expectedVersion, null);
    } catch (err) {
      if (err instanceof HttpException) return null; // state moved on; nothing to do
      throw err;
    }
  }

  /** session-day-end: close a past session only if nobody is left in it. */
  async closeIfEmpty(
    ctx: TenantContext,
    sessionId: string,
  ): Promise<'closed' | 'has_patients' | 'skipped'> {
    return this.mutate(ctx, SYSTEM_ACTOR, null, async (tx) => {
      const session = await tx.lockSession(sessionId);
      if (session.status === SessionStatus.CLOSED) return 'skipped' as const;
      const active = await tx.manager.getRepository(QueueEntry).count({
        where: {
          queueSessionId: session.id,
          status: In(ACTIVE_ENTRY_STATUSES),
        },
      });
      if (active > 0) return 'has_patients' as const;
      await this.updateSession(tx, session, {
        status: SessionStatus.CLOSED,
        closedAt: tx.now,
      });
      await tx.emit(session, {
        eventType: 'SESSION_CLOSED',
        reasonCode: 'DAY_END',
      });
      return 'closed' as const;
    });
  }

  // ═══════════════════════════════════════════════════════════
  // INTERNALS
  // ═══════════════════════════════════════════════════════════

  private async mutate<T>(
    ctx: TenantContext,
    actor: Actor,
    idem: IdempotencyInput,
    work: (tx: QueueTx) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        // One round trip: 3 s lock timeout, tenant context for row-level
        // security, and the transaction's clock ("now" is the DB's, never the
        // API server's).
        const [{ now }] = await sqlRows<{ now: Date }>(
          manager,
          `SELECT set_config('lock_timeout', '3s', true),
                  set_config('app.organization_id', $1, true),
                  set_config('app.location_id', $2, true),
                  now() AS now`,
          [ctx.organizationId, ctx.locationId],
        );

        if (idem) {
          const replay = await this.claimIdempotencyKey(
            manager,
            ctx.organizationId,
            idem,
          );
          if (replay) return replay.body as T;
        }

        const tx = new QueueTx(manager, new Date(now), ctx, actor);
        const result = await work(tx);
        // Plain JSON — exactly what a replay of this key will return later.
        const body = JSON.parse(JSON.stringify(result ?? null)) as T;

        if (idem) {
          await manager.query(
            `UPDATE idempotency_keys SET response_status = 200, response_body = $3
              WHERE organization_id = $1 AND key = $2`,
            [ctx.organizationId, idem.key, JSON.stringify(body)],
          );
        }
        return body;
      });
    } catch (err) {
      throw this.mapDbError(err);
    }
  }

  /**
   * Claims the key for this request (returns null), or — for a replay —
   * returns the response saved by the request that used it first. A
   * concurrent request with the same key waits on the unique row until the
   * first one commits, then sees its response.
   */
  private async claimIdempotencyKey(
    manager: EntityManager,
    organizationId: string,
    idem: { key: string; hash: string },
  ): Promise<{ body: unknown } | null> {
    const inserted = await sqlRows<{ key: string }>(
      manager,
      `INSERT INTO idempotency_keys (organization_id, key, request_hash)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING key`,
      [organizationId, idem.key, idem.hash],
    );
    if (inserted.length) return null;

    const [row] = await sqlRows<{
      request_hash: string;
      response_status: number | null;
      response_body: unknown;
    }>(
      manager,
      `SELECT request_hash, response_status, response_body FROM idempotency_keys
        WHERE organization_id = $1 AND key = $2`,
      [organizationId, idem.key],
    );
    if (row.request_hash !== idem.hash) {
      throw QueueErrors.idempotencyKeyReused();
    }
    if (row.response_status == null) throw QueueErrors.inFlight();
    return { body: row.response_body };
  }

  private mapDbError(err: unknown): unknown {
    if (!(err instanceof QueryFailedError)) return err;
    const { code, constraint } = pgError(err);
    if (code === '55P03') return QueueErrors.lockTimeout();
    if (code === '23505' && constraint === 'one_patient_with_doctor')
      return QueueErrors.doctorBusy();
    if (
      code === '23505' &&
      (constraint === 'one_active_entry_per_appt' ||
        constraint === 'one_active_entry_per_patient')
    ) {
      return QueueErrors.alreadyCheckedIn(null);
    }
    this.logger.error(`Queue transaction failed: ${err.message}`);
    return err;
  }

  private enginePolicy(session: QueueSession, policy: EffectivePolicy) {
    return {
      smartQueueEnabled: session.smartQueueEnabled,
      earlyWindowMin: policy.earlyWindowMin,
      lateGraceMin: policy.lateGraceMin,
      starvationMin: policy.walkinStarvationMin,
    };
  }

  /** Session for an arrival: created on demand, locked, and not closed. */
  private async openSessionForArrival(
    tx: QueueTx,
    policy: EffectivePolicy,
    doctorId: string,
    serviceDate: string,
  ): Promise<QueueSession> {
    const id = await this.tokens.ensureSession(tx.manager, {
      organizationId: tx.ctx.organizationId,
      locationId: tx.ctx.locationId,
      doctorId,
      serviceDate,
      smartQueueEnabled: policy.smartQueueEnabled,
    });
    const session = await tx.lockSession(id);
    if (!CHECK_IN_SESSION_STATUSES.includes(session.status)) {
      throw QueueErrors.sessionNotOpen(session.status);
    }
    return session;
  }

  private async issueToken(
    tx: QueueTx,
    session: QueueSession,
    args: {
      patientId: string;
      appointmentId: string | null;
      queueType: QueueType;
      reasonForVisit: string | null;
      urgentReason?: string;
      convertedFromApptId?: string;
    },
  ): Promise<QueueEntry> {
    const tokenNumber = await this.tokens.nextToken(tx.manager, session.id);
    const urgent = args.urgentReason?.trim();
    const inserted = await tx.manager.insert(QueueEntry, {
      organizationId: session.organizationId,
      queueSessionId: session.id,
      patientId: args.patientId,
      appointmentId: args.appointmentId,
      convertedFromApptId: args.convertedFromApptId ?? null,
      tokenNumber,
      queueType: args.queueType,
      status: EntryStatus.WAITING,
      priorityClass: urgent
        ? PriorityClass.AUTHORIZED_URGENT
        : PriorityClass.NORMAL,
      urgentSince: urgent ? tx.now : null,
      urgentReason: urgent || null,
      reasonForVisit: args.reasonForVisit,
      checkedInAt: tx.now,
      sortAnchorAt: tx.now,
    });
    const entry = await tx.loadEntry(
      (inserted.identifiers[0] as { id: string }).id,
    );
    await tx.emit(session, {
      entry,
      eventType: 'CHECKED_IN',
      to: EntryStatus.WAITING,
      reasonCode: args.convertedFromApptId
        ? 'CONVERTED_TO_WALK_IN'
        : args.queueType,
    });
    if (urgent) {
      await tx.emit(session, {
        entry,
        eventType: 'PRIORITY_SET',
        from: entry.status,
        to: entry.status,
        reasonText: urgent,
      });
    }
    return entry;
  }

  private async cancelEntry(
    tx: QueueTx,
    session: QueueSession,
    entry: QueueEntry,
    reason: string | undefined,
    ifMatch?: number,
  ) {
    await tx.transition(
      session,
      entry,
      EntryStatus.CANCELLED,
      { finishedAt: tx.now },
      {
        eventType: 'CANCELLED',
        reasonText: reason ?? null,
      },
      ifMatch,
    );
    if (entry.appointmentId) {
      await this.closeAppointment(
        tx,
        entry.appointmentId,
        CancelReason.PATIENT_LEFT,
        reason ?? null,
      );
    }
  }

  /** After arrival the appointment can only end as completed or cancelled. */
  private async closeAppointment(
    tx: QueueTx,
    appointmentId: string,
    code: CancelReason,
    reason: string | null,
  ) {
    await tx.manager.update(
      Appointment,
      { id: appointmentId, status: AppointmentStatus.CHECKED_IN },
      {
        status: AppointmentStatus.CANCELLED,
        cancelReasonCode: code,
        cancelReason: reason,
        cancelledAt: tx.now,
        updatedBy: tx.actor.userId,
      },
    );
  }

  /** Lock both sessions in id order (no deadlocks), retire the old entry, issue a new token. */
  private async transferEntry(
    tx: QueueTx,
    fromSessionId: string,
    entryId: string,
    toSessionId: string,
    reason: string | undefined,
    ifMatch?: number,
  ) {
    const [firstId, secondId] = [fromSessionId, toSessionId].sort();
    const first = await tx.lockSession(firstId);
    const second = await tx.lockSession(secondId);
    const from = first.id === fromSessionId ? first : second;
    const to = first.id === toSessionId ? first : second;
    if (!CHECK_IN_SESSION_STATUSES.includes(to.status))
      throw QueueErrors.sessionNotOpen(to.status);

    const entry = await tx.loadEntry(entryId);
    await tx.transition(
      from,
      entry,
      EntryStatus.TRANSFERRED,
      { finishedAt: tx.now },
      {
        eventType: 'TRANSFERRED_OUT',
        reasonText: reason ?? null,
        metadata: { toSessionId: to.id },
      },
      ifMatch,
    );

    const tokenNumber = await this.tokens.nextToken(tx.manager, to.id);
    const inserted = await tx.manager.insert(QueueEntry, {
      organizationId: to.organizationId,
      queueSessionId: to.id,
      patientId: entry.patientId,
      appointmentId: entry.appointmentId,
      convertedFromApptId: entry.convertedFromApptId,
      transferredFromId: entry.id,
      tokenNumber,
      queueType: entry.queueType,
      status: EntryStatus.WAITING,
      priorityClass: entry.priorityClass,
      urgentSince: entry.urgentSince,
      urgentReason: entry.urgentReason,
      reasonForVisit: entry.reasonForVisit,
      // Keeps their place in line by original arrival.
      checkedInAt: entry.checkedInAt,
      sortAnchorAt: entry.sortAnchorAt,
    });
    const moved = await tx.loadEntry(
      (inserted.identifiers[0] as { id: string }).id,
    );
    await tx.emit(to, {
      entry: moved,
      eventType: 'CHECKED_IN',
      to: EntryStatus.WAITING,
      reasonCode: 'TRANSFERRED_IN',
      reasonText: reason ?? null,
      metadata: { fromSessionId: from.id, fromEntryId: entry.id },
    });
    return {
      from: this.query.toEntryView(entry, from.tokenPrefix),
      entry: this.query.toEntryView(moved, to.tokenPrefix),
      token: this.tokens.format(to.tokenPrefix, moved.tokenNumber),
      sessionId: to.id,
    };
  }

  private async sessionChange(
    ctx: TenantContext,
    actor: Actor,
    sessionId: string,
    idem: IdempotencyInput,
    to: SessionStatus,
    eventType: string,
    patch: (s: QueueSession, now: Date) => Partial<QueueSession>,
    reason?: string,
  ) {
    return this.mutate(ctx, actor, idem, async (tx) => {
      const session = await tx.lockSession(sessionId);
      this.assertSessionDoctor(actor, session);
      assertSessionTransition(session.status, to);
      await this.updateSession(tx, session, {
        status: to,
        ...patch(session, tx.now),
      });
      await tx.emit(session, { eventType, reasonText: reason ?? null });
      return this.sessionResult(session);
    });
  }

  private async updateSession(
    tx: QueueTx,
    session: QueueSession,
    patch: Partial<QueueSession>,
  ) {
    await tx.manager
      .createQueryBuilder()
      .update(QueueSession)
      .set(sessionPatch(patch))
      .where('id = :id', { id: session.id })
      .execute();
    Object.assign(session, patch, { version: session.version + 1 });
  }

  private async setLastCallReason(
    tx: QueueTx,
    session: QueueSession,
    reason: SelectionReason,
  ) {
    await this.updateSession(tx, session, { lastCallReason: reason });
  }

  private assertOpen(session: QueueSession) {
    if (session.status !== SessionStatus.OPEN)
      throw QueueErrors.sessionNotOpen(session.status);
  }

  private async assertDoctorFree(tx: QueueTx, session: QueueSession) {
    const busy = await tx.manager.getRepository(QueueEntry).count({
      where: { queueSessionId: session.id, status: In(WITH_DOCTOR_STATUSES) },
    });
    if (busy) throw QueueErrors.doctorBusy();
  }

  /** Doctor actions: only this session's doctor, or a clinic admin. */
  private assertSessionDoctor(actor: Actor, session: QueueSession) {
    if (actor === SYSTEM_ACTOR) return;
    if (actor.roles.includes(AppRole.CLINIC_ADMIN)) return;
    if (
      actor.roles.includes(AppRole.DOCTOR) &&
      actor.employeeId === session.doctorId
    )
      return;
    throw QueueErrors.forbidden("Only this queue's doctor can do that");
  }

  /** A doctor without reception rights may only skip in their own session. */
  private isDoctorOnly(actor: Actor): boolean {
    return (
      actor !== SYSTEM_ACTOR &&
      !actor.roles.includes(AppRole.CLINIC_ADMIN) &&
      !actor.roles.includes(AppRole.RECEPTIONIST)
    );
  }

  private async assertDoctorAtLocation(tx: QueueTx, doctorId: string) {
    const assignment = await tx.manager
      .getRepository(EmployeeOrgLocationAssignment)
      .findOne({
        where: {
          employeeId: doctorId,
          organizationId: tx.ctx.organizationId,
          locationId: tx.ctx.locationId,
          isActive: true,
        },
        relations: { employee: true },
      });
    if (!assignment || !assignment.employee?.isActive) {
      throw QueueErrors.notFound('Doctor at this location');
    }
  }

  /** Existing patient, or a quick-created one from name + phone. */
  private async resolvePatient(tx: QueueTx, dto: WalkInDto): Promise<string> {
    const repo = tx.manager.getRepository(Patient);
    if (dto.patientId) {
      const patient = await repo.findOne({
        where: { id: dto.patientId, organizationId: tx.ctx.organizationId },
      });
      if (!patient) throw QueueErrors.notFound('Patient');
      return patient.id;
    }
    // Serialize number allocation per organization: two desks registering
    // walk-ins at once must not both compute the same next number.
    await tx.manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `patient_number:${tx.ctx.organizationId}`,
    ]);
    const [{ next }] = await sqlRows<{ next: string }>(
      tx.manager,
      `SELECT GREATEST(
                COUNT(*),
                COALESCE(MAX(CAST(substring(patient_number FROM '^P-([0-9]+)$') AS int)), 0)
              ) + 1 AS next
         FROM patients WHERE organization_id = $1`,
      [tx.ctx.organizationId],
    );
    const saved = await repo.save(
      repo.create({
        organizationId: tx.ctx.organizationId,
        patientNumber: `P-${String(next).padStart(5, '0')}`,
        fullName: dto.patientName!.trim(),
        phone: dto.patientPhone!.trim(),
        primaryLocationId: tx.ctx.locationId,
        createdBy: tx.actor.userId,
      }),
    );
    return saved.id;
  }

  private arrivalResult(tx: QueueTx, session: QueueSession, entry: QueueEntry) {
    return {
      entry: this.query.toEntryView(entry, session.tokenPrefix),
      token: this.tokens.format(session.tokenPrefix, entry.tokenNumber),
      sessionId: session.id,
      doctorId: session.doctorId,
      serviceDate: session.serviceDate,
      eventSeq: Number(session.eventSeq),
    };
  }

  private entryResult(
    session: QueueSession,
    entry: QueueEntry,
  ): { entry: EntryView; eventSeq: number } {
    return {
      entry: this.query.toEntryView(entry, session.tokenPrefix),
      eventSeq: Number(session.eventSeq),
    };
  }

  private sessionResult(session: QueueSession) {
    return { session: this.query.toSessionView(session) };
  }
}
