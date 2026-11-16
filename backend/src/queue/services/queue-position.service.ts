import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { QueueEntry } from '../entities/queue-entry.entity';
import { EntryStatus, WITH_DOCTOR_STATUSES } from '../enums/queue.enums';
import { QueuePoliciesService } from './queue-policies.service';
import { QueueQueryService } from './queue-query.service';
import { TokenEngine } from './token-engine.service';
import { ClockService } from 'src/common/clock/clock.service';

/**
 * What a patient (or a public visit page) may know about one queue entry:
 * its own token, status and place — never another patient's data.
 */
export interface EntryPosition {
  entryId: string;
  organizationId: string;
  locationId: string;
  patientId: string;
  sessionId: string;
  serviceDate: string;
  token: string;
  status: EntryStatus;
  doctorName: string | null;
  /** Waiting patients the engine would call first; 0 with the doctor; null on hold / skipped / finished. */
  peopleAhead: number | null;
  nowServingToken: string | null;
  /** Session event sequence, for client-side de-duplication. */
  seq: number;
}

/** Position of entries in their doctor's queue, for the patient surfaces (M3-05). */
@Injectable()
export class QueuePositionService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly query: QueueQueryService,
    private readonly policies: QueuePoliciesService,
    private readonly tokens: TokenEngine,
    private readonly clock: ClockService,
  ) {}

  async positions(entryIds: string[]): Promise<EntryPosition[]> {
    if (entryIds.length === 0) return [];
    const entries = await this.dataSource.getRepository(QueueEntry).find({
      where: { id: In(entryIds) },
      relations: { session: { doctor: true } },
    });
    const sessionIds = [...new Set(entries.map((e) => e.queueSessionId))];
    const siblings = await this.query.loadEntries(
      this.dataSource.manager,
      sessionIds,
    );
    const now = this.clock.now();
    const out: EntryPosition[] = [];
    const orderCache = new Map<string, string[]>();

    for (const e of entries) {
      const session = e.session;
      const mine = siblings.filter((s) => s.queueSessionId === session.id);
      let order = orderCache.get(session.id);
      if (!order) {
        const policy = await this.policies.getEffective(
          session.organizationId,
          session.locationId,
        );
        order = this.query.engineOrder(
          mine.filter((s) => s.status === EntryStatus.WAITING),
          session,
          policy,
          now,
        ).order;
        orderCache.set(session.id, order);
      }
      const current = mine.find((s) => WITH_DOCTOR_STATUSES.includes(s.status));
      let peopleAhead: number | null = null;
      if (e.status === EntryStatus.WAITING) {
        const i = order.indexOf(e.id);
        peopleAhead = i >= 0 ? i : null;
      } else if (WITH_DOCTOR_STATUSES.includes(e.status)) {
        peopleAhead = 0;
      }
      out.push({
        entryId: e.id,
        organizationId: e.organizationId,
        locationId: session.locationId,
        patientId: e.patientId,
        sessionId: session.id,
        serviceDate: session.serviceDate,
        token: this.tokens.format(session.tokenPrefix, e.tokenNumber),
        status: e.status,
        doctorName: session.doctor?.fullName ?? null,
        peopleAhead,
        nowServingToken: current
          ? this.tokens.format(session.tokenPrefix, current.tokenNumber)
          : null,
        seq: Number(session.eventSeq),
      });
    }
    return out;
  }
}
