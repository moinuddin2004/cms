import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { ClockService } from 'src/common/clock/clock.service';
import { Location } from 'src/locations/entities/location.entity';
import { QueueEntry } from 'src/queue/entities/queue-entry.entity';
import { ACTIVE_ENTRY_STATUSES } from 'src/queue/enums/queue.enums';
import { QueuePositionService } from 'src/queue/services/queue-position.service';
import {
  linkedPatientWhere,
  type PatientContext,
} from '../context/patient-context';
import { PatientClinicsService } from '../reads/patient-clinics.service';
import type { ClinicRefDto } from '../reads/patient-reads.types';

export interface ActiveQueueEntryDto {
  entryId: string;
  profileId: string;
  clinic: ClinicRefDto;
  location: { id: string; name: string; timezone: string };
  token: string;
  status: string;
  doctorName: string | null;
  peopleAhead: number | null;
  nowServingToken: string | null;
  serviceDate: string;
}

/** Live queue data for the patient (M3-05): `/patient-api/queue/active` and socket subscriptions. */
@Injectable()
export class PatientQueueService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clinics: PatientClinicsService,
    private readonly positions: QueuePositionService,
    private readonly clock: ClockService,
  ) {}

  /** Today's active queue entries of every linked patient, across clinics. */
  async active(ctx: PatientContext): Promise<ActiveQueueEntryDto[]> {
    const scope = await this.clinics.visibleScope(ctx);
    const visible = scope.ctx.links.filter((l) =>
      scope.clinics.has(l.organizationId),
    );
    if (visible.length === 0) return [];
    const narrowed: PatientContext = { ...scope.ctx, links: visible };

    // Bound the scan to the last days; "today" is decided per location below.
    const floor = new Date(this.clock.now().getTime() - 2 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const qb = this.dataSource
      .getRepository(QueueEntry)
      .createQueryBuilder('qe')
      .innerJoinAndSelect('qe.session', 's')
      .where('qe.status IN (:...statuses)', { statuses: ACTIVE_ENTRY_STATUSES })
      .andWhere('s.service_date >= :floor', { floor });
    linkedPatientWhere(qb, narrowed, { alias: 'qe' });
    const entities = await qb.getMany();
    if (entities.length === 0) return [];

    const locationIds = [...new Set(entities.map((e) => e.session.locationId))];
    const locations = new Map(
      (
        await this.dataSource.getRepository(Location).find({
          where: { id: In(locationIds) },
          select: { id: true, name: true, timezone: true },
        })
      ).map((l) => [l.id, l]),
    );

    const todays = entities.filter((e) => {
      const loc = locations.get(e.session.locationId);
      return !!loc && e.session.serviceDate === this.clock.today(loc.timezone);
    });
    const positions = await this.positions.positions(todays.map((e) => e.id));

    const out: ActiveQueueEntryDto[] = [];
    for (const p of positions) {
      const link = visible.find(
        (l) =>
          l.organizationId === p.organizationId && l.patientId === p.patientId,
      );
      const clinic = scope.clinics.get(p.organizationId);
      const loc = locations.get(p.locationId);
      if (!link || !clinic || !loc) continue;
      out.push({
        entryId: p.entryId,
        profileId: link.profileId,
        clinic: clinic.ref,
        location: { id: loc.id, name: loc.name, timezone: loc.timezone },
        token: p.token,
        status: p.status,
        doctorName: p.doctorName,
        peopleAhead: p.peopleAhead,
        nowServingToken: p.nowServingToken,
        serviceDate: p.serviceDate,
      });
    }
    return out.sort((a, b) => a.token.localeCompare(b.token));
  }

  /**
   * Socket subscription check: the queue session of `entryId` when the entry's
   * patient is in one of the account's live links (active/frozen) at an
   * approved clinic, else null. Evaluated on every subscribe and on link changes.
   */
  async subscribableSession(
    accountId: string,
    entryId: string,
  ): Promise<string | null> {
    const rows: { queue_session_id: string }[] = await this.dataSource.query(
      `SELECT e.queue_session_id
         FROM queue_entries e
         JOIN patient_record_links l
           ON l.organization_id = e.organization_id
          AND l.patient_id = e.patient_id
          AND l.status IN ('active', 'frozen')
         JOIN patient_profiles p ON p.id = l.profile_id
         JOIN organizations o ON o.id = e.organization_id
        WHERE e.id = $1 AND p.account_id = $2 AND o.approval_status = 'approved'
        LIMIT 1`,
      [entryId, accountId],
    );
    return rows[0]?.queue_session_id ?? null;
  }
}
