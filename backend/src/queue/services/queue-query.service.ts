import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { QueueSession } from '../entities/queue-session.entity';
import { QueueEntry } from '../entities/queue-entry.entity';
import { QueueEvent } from '../entities/queue-event.entity';
import {
  EntryStatus,
  PriorityClass,
  QueueType,
  SelectionReason,
  WITH_DOCTOR_STATUSES,
} from '../enums/queue.enums';
import { Candidate, selectNext } from '../engines/selection-engine';
import {
  EffectivePolicy,
  QueuePoliciesService,
} from './queue-policies.service';
import { TokenEngine } from './token-engine.service';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { ClockService } from 'src/common/clock/clock.service';
import { isYmd } from 'src/common/clock/tz.util';
import { QueueErrors } from '../queue.errors';

export interface EntryView {
  id: string;
  sessionId: string;
  token: string;
  tokenNumber: number;
  queueType: QueueType;
  status: EntryStatus;
  priorityClass: PriorityClass;
  urgentReason: string | null;
  urgentSince: Date | null;
  patient: {
    id: string;
    fullName: string;
    phone: string | null;
    patientNumber: string | null;
  } | null;
  appointmentId: string | null;
  scheduledStart: Date | null;
  reasonForVisit: string | null;
  checkedInAt: Date;
  sortAnchorAt: Date;
  calledAt: Date | null;
  consultationStartedAt: Date | null;
  holdStartedAt: Date | null;
  returnedFromHoldAt: Date | null;
  skippedAt: Date | null;
  finishedAt: Date | null;
  convertedFromApptId: string | null;
  transferredFromId: string | null;
  version: number;
}

export interface SessionView {
  id: string;
  organizationId: string;
  locationId: string;
  doctorId: string;
  doctorName: string | null;
  serviceDate: string;
  status: string;
  tokenPrefix: string;
  smartQueueEnabled: boolean;
  pauseReason: string | null;
  startedAt: Date | null;
  closedAt: Date | null;
  lastCallReason: string | null;
  eventSeq: number;
  version: number;
}

export interface SessionSnapshot {
  session: SessionView;
  entries: EntryView[];
  /** WAITING entry ids in the order the engine would call them now. */
  waitingOrder: string[];
  /** What Call Next would pick right now (nothing is reserved). */
  suggestion: { entryId: string; reason: SelectionReason } | null;
  now: Date;
}

/**
 * Read side of the queue: snapshots, reception lanes, TV display, tickets,
 * audit history. Never mutates. Methods that the orchestrator needs inside
 * its transaction accept an optional EntityManager.
 */
@Injectable()
export class QueueQueryService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policies: QueuePoliciesService,
    private readonly tokens: TokenEngine,
    private readonly clock: ClockService,
  ) {}

  // ─── Views ─────────────────────────────────────────────────────

  toEntryView(e: QueueEntry, prefix: string): EntryView {
    return {
      id: e.id,
      sessionId: e.queueSessionId,
      token: this.tokens.format(prefix, e.tokenNumber),
      tokenNumber: e.tokenNumber,
      queueType: e.queueType,
      status: e.status,
      priorityClass: e.priorityClass,
      urgentReason: e.urgentReason,
      urgentSince: e.urgentSince,
      patient: e.patient
        ? {
            id: e.patient.id,
            fullName: e.patient.fullName,
            phone: e.patient.phone || null,
            patientNumber: e.patient.patientNumber || null,
          }
        : null,
      appointmentId: e.appointmentId,
      scheduledStart: e.appointment?.startTime ?? null,
      reasonForVisit: e.reasonForVisit ?? e.appointment?.reasonForVisit ?? null,
      checkedInAt: e.checkedInAt,
      sortAnchorAt: e.sortAnchorAt,
      calledAt: e.calledAt,
      consultationStartedAt: e.consultationStartedAt,
      holdStartedAt: e.holdStartedAt,
      returnedFromHoldAt: e.returnedFromHoldAt,
      skippedAt: e.skippedAt,
      finishedAt: e.finishedAt,
      convertedFromApptId: e.convertedFromApptId,
      transferredFromId: e.transferredFromId,
      version: e.version,
    };
  }

  toSessionView(s: QueueSession): SessionView {
    return {
      id: s.id,
      organizationId: s.organizationId,
      locationId: s.locationId,
      doctorId: s.doctorId,
      doctorName: s.doctor?.fullName ?? null,
      serviceDate: s.serviceDate,
      status: s.status,
      tokenPrefix: s.tokenPrefix,
      smartQueueEnabled: s.smartQueueEnabled,
      pauseReason: s.pauseReason,
      startedAt: s.startedAt,
      closedAt: s.closedAt,
      lastCallReason: s.lastCallReason,
      eventSeq: Number(s.eventSeq),
      version: s.version,
    };
  }

  /** Engine candidate from an entry (scheduled start needed for appointment priority). */
  toCandidate(e: QueueEntry): Candidate {
    return {
      id: e.id,
      token: e.tokenNumber,
      type: e.queueType === QueueType.APPOINTMENT ? 'APPOINTMENT' : 'WALK_IN',
      urgentSince:
        e.priorityClass === PriorityClass.AUTHORIZED_URGENT
          ? e.urgentSince
          : null,
      scheduledStart: e.appointment?.startTime ?? null,
      checkedInAt: e.checkedInAt,
      sortAnchorAt: e.sortAnchorAt,
      returnedFromHoldAt: e.returnedFromHoldAt,
    };
  }

  /**
   * The order the engine would call the WAITING entries in, by repeatedly
   * asking it for the next one (it is pure, so this reserves nothing).
   */
  engineOrder(
    waiting: QueueEntry[],
    session: Pick<QueueSession, 'smartQueueEnabled' | 'lastCallReason'>,
    policy: EffectivePolicy,
    now: Date,
  ): {
    order: string[];
    first: { entryId: string; reason: SelectionReason } | null;
  } {
    const enginePolicy = {
      smartQueueEnabled: session.smartQueueEnabled,
      earlyWindowMin: policy.earlyWindowMin,
      lateGraceMin: policy.lateGraceMin,
      starvationMin: policy.walkinStarvationMin,
    };
    let rest = waiting.map((e) => this.toCandidate(e));
    let last = session.lastCallReason;
    const order: string[] = [];
    let first: { entryId: string; reason: SelectionReason } | null = null;
    while (rest.length) {
      const d = selectNext(rest, now, enginePolicy, last);
      if (!d) break;
      if (!first) first = d;
      order.push(d.entryId);
      last = d.reason;
      rest = rest.filter((c) => c.id !== d.entryId);
    }
    return { order, first };
  }

  // ─── Snapshots ─────────────────────────────────────────────────

  async loadEntries(
    manager: EntityManager,
    sessionIds: string[],
  ): Promise<QueueEntry[]> {
    if (!sessionIds.length) return [];
    return manager.getRepository(QueueEntry).find({
      where: { queueSessionId: In(sessionIds) },
      relations: { patient: true, appointment: true },
      order: { sortAnchorAt: 'ASC', tokenNumber: 'ASC' },
    });
  }

  async snapshot(
    ctx: TenantContext,
    sessionId: string,
    manager: EntityManager = this.dataSource.manager,
    now: Date = this.clock.now(),
  ): Promise<SessionSnapshot> {
    const session = await manager.getRepository(QueueSession).findOne({
      where: {
        id: sessionId,
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
      },
      relations: { doctor: true },
    });
    if (!session) throw QueueErrors.notFound('Queue session');
    return this.buildSnapshot(
      ctx,
      session,
      await this.loadEntries(manager, [session.id]),
      now,
    );
  }

  private async buildSnapshot(
    ctx: TenantContext,
    session: QueueSession,
    entries: QueueEntry[],
    now: Date,
  ): Promise<SessionSnapshot> {
    const policy = await this.policies.getEffective(
      ctx.organizationId,
      ctx.locationId,
    );
    const waiting = entries.filter((e) => e.status === EntryStatus.WAITING);
    const { order, first } = this.engineOrder(waiting, session, policy, now);
    const withDoctor = entries.some((e) =>
      WITH_DOCTOR_STATUSES.includes(e.status),
    );
    return {
      session: this.toSessionView(session),
      entries: entries.map((e) => this.toEntryView(e, session.tokenPrefix)),
      waitingOrder: order,
      suggestion: withDoctor ? null : first,
      now,
    };
  }

  /**
   * Reception board: one lane per doctor working at the location, with that
   * doctor's session for the service date (null until the first check-in).
   */
  async lanes(ctx: TenantContext, date?: string) {
    const policy = await this.policies.getEffective(
      ctx.organizationId,
      ctx.locationId,
    );
    const now = this.clock.now();
    const serviceDate = isYmd(date)
      ? date
      : this.policies.serviceDate(policy, now);

    const assignments = await this.dataSource
      .getRepository(EmployeeOrgLocationAssignment)
      .find({
        where: {
          organizationId: ctx.organizationId,
          locationId: ctx.locationId,
          isActive: true,
        },
        relations: { employee: true },
      });
    const doctors = assignments
      .filter((a) => a.employee?.isActive)
      .map((a) => ({
        id: a.employee.id,
        fullName: a.employee.fullName,
        designation: a.designation,
        profilePictureUrl: a.employee.profilePictureUrl ?? null,
        tokenPrefix: this.tokens.prefixFor(a, a.employee.fullName),
      }));

    const sessions = await this.dataSource.getRepository(QueueSession).find({
      where: {
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
        serviceDate,
      },
      relations: { doctor: true },
    });
    const entries = await this.loadEntries(
      this.dataSource.manager,
      sessions.map((s) => s.id),
    );

    const lanes = await Promise.all(
      doctors.map(async (doctor) => {
        const session = sessions.find((s) => s.doctorId === doctor.id);
        return {
          doctor,
          snapshot: session
            ? await this.buildSnapshot(
                ctx,
                session,
                entries.filter((e) => e.queueSessionId === session.id),
                now,
              )
            : null,
        };
      }),
    );
    return { serviceDate, now, policy, lanes };
  }

  /** The signed-in doctor's own session for today (null if none yet). */
  async findSessionId(
    ctx: TenantContext,
    doctorId: string,
    serviceDate: string,
  ): Promise<string | null> {
    const s = await this.dataSource.getRepository(QueueSession).findOne({
      where: {
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
        doctorId,
        serviceDate,
      },
      select: { id: true },
    });
    return s?.id ?? null;
  }

  // ─── TV display (no patient names, ever) ───────────────────────

  async displayState(locationId: string) {
    const location = await this.dataSource.getRepository(Location).findOne({
      where: { id: locationId, isActive: true },
    });
    if (!location) throw QueueErrors.notFound('Location');
    const policy = await this.policies.getEffective(
      location.organizationId,
      locationId,
    );
    const now = this.clock.now();
    const serviceDate = this.policies.serviceDate(policy, now);

    const sessions = await this.dataSource.getRepository(QueueSession).find({
      where: {
        organizationId: location.organizationId,
        locationId,
        serviceDate,
      },
      relations: { doctor: true },
      order: { createdAt: 'ASC' },
    });
    const entries = await this.loadEntries(
      this.dataSource.manager,
      sessions.map((s) => s.id),
    );

    return {
      locationId,
      locationName: location.name,
      // The TV runs without a login, so it needs the clock it should show.
      timezone: policy.timezone,
      serviceDate,
      now,
      doctors: sessions.map((s) => {
        const mine = entries.filter((e) => e.queueSessionId === s.id);
        const current = mine.find((e) =>
          WITH_DOCTOR_STATUSES.includes(e.status),
        );
        const waiting = mine.filter((e) => e.status === EntryStatus.WAITING);
        const { order } = this.engineOrder(waiting, s, policy, now);
        return {
          sessionId: s.id,
          doctorId: s.doctorId,
          doctorName: s.doctor?.fullName ?? null,
          status: s.status,
          nowServing: current
            ? {
                token: this.tokens.format(s.tokenPrefix, current.tokenNumber),
                status: current.status,
              }
            : null,
          next: order
            .slice(0, 5)
            .map((id) => mine.find((e) => e.id === id)!)
            .map((e) => this.tokens.format(s.tokenPrefix, e.tokenNumber)),
          waitingCount: waiting.length,
        };
      }),
    };
  }

  // ─── Ticket, history, visits ───────────────────────────────────

  async ticket(ctx: TenantContext, entryId: string) {
    const entry = await this.dataSource.getRepository(QueueEntry).findOne({
      where: { id: entryId, organizationId: ctx.organizationId },
      relations: {
        session: { doctor: true },
        patient: true,
        appointment: true,
      },
    });
    if (!entry || entry.session.locationId !== ctx.locationId) {
      throw QueueErrors.notFound('Queue entry');
    }
    const [org, location] = await Promise.all([
      this.dataSource
        .getRepository(Organization)
        .findOne({ where: { id: ctx.organizationId } }),
      this.dataSource
        .getRepository(Location)
        .findOne({ where: { id: ctx.locationId } }),
    ]);
    const policy = await this.policies.getEffective(
      ctx.organizationId,
      ctx.locationId,
    );
    const siblings = await this.loadEntries(this.dataSource.manager, [
      entry.queueSessionId,
    ]);
    const waiting = siblings.filter((e) => e.status === EntryStatus.WAITING);
    const { order } = this.engineOrder(
      waiting,
      entry.session,
      policy,
      this.clock.now(),
    );
    const position = order.indexOf(entry.id);

    return {
      clinicName: org?.name ?? null,
      locationName: location?.name ?? null,
      doctorName: entry.session.doctor?.fullName ?? null,
      serviceDate: entry.session.serviceDate,
      token: this.tokens.format(entry.session.tokenPrefix, entry.tokenNumber),
      queueType: entry.queueType,
      patientName: entry.patient?.fullName ?? null,
      scheduledStart: entry.appointment?.startTime ?? null,
      checkedInAt: entry.checkedInAt,
      /** Approximate: how many waiting patients the engine would call first. */
      peopleAhead: position >= 0 ? position : null,
      status: entry.status,
    };
  }

  async events(ctx: TenantContext, sessionId: string, afterSeq = 0) {
    const session = await this.dataSource.getRepository(QueueSession).findOne({
      where: {
        id: sessionId,
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
      },
    });
    if (!session) throw QueueErrors.notFound('Queue session');
    const rows = await this.dataSource
      .getRepository(QueueEvent)
      .createQueryBuilder('e')
      .where('e.queue_session_id = :sessionId', { sessionId })
      .andWhere('e.seq > :afterSeq', { afterSeq })
      .orderBy('e.seq', 'ASC')
      .getMany();
    return rows.map((r) => ({ ...r, seq: Number(r.seq), id: Number(r.id) }));
  }

  /** A patient's queue visits (booked and walk-in), newest first. */
  async patientVisits(ctx: TenantContext, patientId: string) {
    const entries = await this.dataSource.getRepository(QueueEntry).find({
      where: { organizationId: ctx.organizationId, patientId },
      relations: { session: { doctor: true }, appointment: true },
      order: { checkedInAt: 'DESC' },
      take: 200,
    });
    return entries.map((e) => ({
      ...this.toEntryView(e, e.session.tokenPrefix),
      serviceDate: e.session.serviceDate,
      locationId: e.session.locationId,
      doctorId: e.session.doctorId,
      doctorName: e.session.doctor?.fullName ?? null,
    }));
  }
}
