import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActorSide, AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { ClockService } from 'src/common/clock/clock.service';
import { linkedPatientWhere, PatientContext } from '../context/patient-context';
import { PatientClinicsService } from '../reads/patient-clinics.service';
import { CONFIRMABLE_STATUSES } from '../reads/patient-reads.mappers';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });

export interface ConfirmAppointmentResult {
  id: string;
  patientConfirmedAt: string;
}

interface Row {
  id: string;
  organizationId: string;
  patientId: string;
  status: string;
  startTime: Date | string;
  patientConfirmedAt: Date | string | null;
}

/** Patient writes on appointments (M3-08). */
@Injectable()
export class PatientAppointmentsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clinics: PatientClinicsService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  /**
   * Idempotent: confirming twice returns the first timestamp. Scoped to the
   * caller's active, app-enabled links of clinics that are active; anything
   * else (other family/clinic, frozen link) is a 404, never a leak.
   */
  async confirm(
    ctx: PatientContext,
    id: string,
  ): Promise<ConfirmAppointmentResult> {
    if (!UUID_RE.test(id)) throw notFound();
    const visible = await this.clinics.visibleScope(ctx);
    const scoped: PatientContext = {
      ...visible.ctx,
      links: visible.ctx.links.filter(
        (l) =>
          l.status === 'active' &&
          l.patientAppEnabled &&
          visible.clinics.get(l.organizationId)?.ref.clinicStatus === 'active',
      ),
    };

    return this.dataSource.transaction(async (m) => {
      const qb = m
        .createQueryBuilder()
        .select([
          'a.id AS "id"',
          'a.organization_id AS "organizationId"',
          'a.patient_id AS "patientId"',
          'a.status AS "status"',
          'a.start_time AS "startTime"',
          'a.patient_confirmed_at AS "patientConfirmedAt"',
        ])
        .from('appointments', 'a')
        .where('a.id = :id', { id })
        .setLock('pessimistic_write');
      linkedPatientWhere(qb, scoped, { alias: 'a', includeFrozen: false });
      const row = await qb.getRawOne<Row>();
      if (!row) throw notFound();

      if (row.patientConfirmedAt) {
        return {
          id: row.id,
          patientConfirmedAt: new Date(row.patientConfirmedAt).toISOString(),
        };
      }
      const at = this.clock.now();
      const profileId = ctx.links.find(
        (l) =>
          l.organizationId === row.organizationId && l.patientId === row.patientId,
      )?.profileId;
      if (
        !CONFIRMABLE_STATUSES.includes(row.status) ||
        new Date(row.startTime).getTime() <= at.getTime()
      ) {
        throw new ConflictException({
          code: 'APPOINTMENT_NOT_CONFIRMABLE',
          message: 'This appointment can no longer be confirmed',
        });
      }

      await m.query(
        'UPDATE appointments SET patient_confirmed_at = $2, updated_at = now() WHERE id = $1',
        [row.id, at],
      );
      await this.audit.record(
        m,
        { userId: null, side: ActorSide.SYSTEM },
        {
          organizationId: row.organizationId,
          entityType: 'appointment',
          entityId: row.id,
          subjectId: row.patientId,
          action: AuditAction.UPDATE,
          before: { patientConfirmedAt: null },
          after: {
            patientConfirmedAt: at.toISOString(),
            confirmedBy: 'patient_app',
            accountId: ctx.accountId,
            profileId: profileId ?? null,
          },
        },
      );
      return { id: row.id, patientConfirmedAt: at.toISOString() };
    });
  }
}
