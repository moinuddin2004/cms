import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { addDays } from 'src/common/clock/tz.util';
import { MedicationDoseEvent } from 'src/medications/entities/medication-dose-event.entity';
import { MedicationSchedule } from 'src/medications/entities/medication-schedule.entity';
import { assertProfile, PatientContext } from '../context/patient-context';
import { PatientClinicsService } from '../reads/patient-clinics.service';
import type {
  DoseEventDto,
  DoseEventInputDto,
  DoseEventsQueryDto,
  MedicationListDto,
  MedicationScheduleDto,
  MedicationsQueryDto,
  PatchMedicationDto,
} from './patient-medications.dto';

const MAX_SCHEDULES = 500;
const MAX_EVENT_RANGE_DAYS = 92;
const MAX_EVENTS_RETURNED = 5000;
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });

const badRequest = (code: string, message: string) =>
  new BadRequestException({ code, message });

interface Cursor {
  at: Date;
  id: string | null;
}

/** `<instant>` or `<instant>|<id>` (the composite cursor of `list`). */
function parseCursor(raw?: string): Cursor | null {
  if (!raw) return null;
  const [instant, id] = raw.split('|');
  const at = new Date(instant);
  if (Number.isNaN(at.getTime())) {
    throw badRequest('INVALID_CURSOR', 'updatedSince is not a valid cursor');
  }
  return { at, id: id ?? null };
}

const msIso = (d: Date) => new Date(Math.floor(d.getTime())).toISOString();

function isRealYmd(value: string): boolean {
  try {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;
  } catch {
    return false;
  }
}

/**
 * Patient medication endpoints (M3-02). A schedule belongs to a PROFILE of the
 * caller's account; every query is restricted to those profile ids, and an id
 * outside them is a plain 404 (no existence leak). Schedules are the patient's
 * own data, so they stay visible/editable after a clinic link is revoked.
 */
@Injectable()
export class PatientMedicationsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clinics: PatientClinicsService,
  ) {}

  private profileIds(ctx: PatientContext, profileId?: string): string[] {
    if (profileId !== undefined) return [assertProfile(ctx, profileId).id];
    return ctx.profiles.map((p) => p.id);
  }

  // ── list ───────────────────────────────────────────────────────────

  /**
   * Oldest change first, so the 500 cap never drops a change: when more
   * exist, `nextUpdatedSince` is the cursor for the next call. Schedules the
   * clinic cut off (hidden, A-23) are not listed — except as `stopped`
   * tombstones when `updatedSince` is given, so an incremental client learns
   * to cancel their reminders.
   */
  async list(
    ctx: PatientContext,
    q: MedicationsQueryDto,
  ): Promise<MedicationListDto> {
    const ids = this.profileIds(ctx, q.profileId);
    if (ids.length === 0) return { items: [], nextUpdatedSince: null };
    const cursor = parseCursor(q.updatedSince);
    const ms = "date_trunc('milliseconds', s.updated_at)";
    // Ordered and compared on the millisecond the cursor can carry, so the
    // (updated_at, id) pair is a total order the client can resume from.
    const qb = this.dataSource
      .getRepository(MedicationSchedule)
      .createQueryBuilder('s')
      .where('s.profile_id IN (:...ids)', { ids });
    if (!cursor) {
      qb.andWhere('s.hidden = false');
    } else if (cursor.id) {
      qb.andWhere(
        `(${ms}, s.id) > (CAST(:at AS timestamptz), CAST(:cid AS uuid))`,
        {
          at: cursor.at.toISOString(),
          cid: cursor.id,
        },
      );
    } else {
      qb.andWhere(`${ms} >= CAST(:at AS timestamptz)`, {
        at: cursor.at.toISOString(),
      });
    }
    const rows = await qb
      .orderBy(ms, 'ASC')
      .addOrderBy('s.id', 'ASC')
      .limit(MAX_SCHEDULES + 1)
      .getMany();
    const more = rows.length > MAX_SCHEDULES;
    const page = more ? rows.slice(0, MAX_SCHEDULES) : rows;
    const last = page[page.length - 1];
    return {
      items: await this.toDtos(ctx, page),
      nextUpdatedSince: more ? `${msIso(last.updatedAt)}|${last.id}` : null,
    };
  }

  // ── patch ──────────────────────────────────────────────────────────

  async patch(
    ctx: PatientContext,
    id: string,
    dto: PatchMedicationDto,
  ): Promise<MedicationScheduleDto> {
    if (!UUID_RE.test(id)) throw notFound();
    const ids = this.profileIds(ctx);
    if (ids.length === 0) throw notFound();
    if (
      dto.times === undefined &&
      dto.endDate === undefined &&
      dto.status === undefined
    ) {
      throw badRequest('NOTHING_TO_UPDATE', 'Nothing to update');
    }

    const repo = this.dataSource.getRepository(MedicationSchedule);
    const row = await repo.findOne({
      where: { id, profileId: In(ids), hidden: false },
    });
    if (!row) throw notFound();
    this.assertEditable(ctx, row);

    if (dto.times !== undefined) {
      row.times = [...new Set(dto.times)].sort();
    }
    if (dto.endDate !== undefined) {
      if (dto.endDate === null) {
        row.endDate = null;
      } else {
        if (!isRealYmd(dto.endDate)) {
          throw badRequest('INVALID_END_DATE', 'endDate is not a valid date');
        }
        if (dto.endDate < row.startDate) {
          throw badRequest(
            'INVALID_END_DATE',
            'endDate cannot be before the start date',
          );
        }
        row.endDate = dto.endDate;
      }
      // Either a date or an explicit "no end": the patient decided.
      row.endDateSource = 'patient';
    }
    if (dto.status !== undefined) row.status = dto.status;
    row.patientEdited = true;

    await repo.save(row);
    return (await this.toDtos(ctx, [row]))[0];
  }

  /**
   * A prescription schedule is editable only while its clinic link is active
   * and the clinic's patient app is on; after the patient left (or the clinic
   * froze the link) it stays visible but read-only (A-23).
   */
  private assertEditable(ctx: PatientContext, row: MedicationSchedule): void {
    if (row.source !== 'prescription') return;
    const link = ctx.links.find(
      (l) =>
        l.profileId === row.profileId &&
        l.organizationId === row.organizationId,
    );
    if (!link || link.status !== 'active' || !link.patientAppEnabled) {
      throw new ForbiddenException({
        code: 'PATIENT_APP_DISABLED',
        message: 'This medicine is read-only',
      });
    }
  }

  // ── dose events ────────────────────────────────────────────────────

  async listDoseEvents(
    ctx: PatientContext,
    q: DoseEventsQueryDto,
  ): Promise<DoseEventDto[]> {
    const from = new Date(q.from);
    const to = new Date(q.to);
    if (!(from.getTime() < to.getTime())) {
      throw badRequest('INVALID_RANGE', '`from` must be before `to`');
    }
    if (to.getTime() - from.getTime() > MAX_EVENT_RANGE_DAYS * DAY_MS) {
      throw badRequest(
        'RANGE_TOO_LARGE',
        `Range is limited to ${MAX_EVENT_RANGE_DAYS} days`,
      );
    }
    const ids = this.profileIds(ctx, q.profileId);
    if (ids.length === 0) return [];

    const rows = await this.dataSource
      .getRepository(MedicationDoseEvent)
      .createQueryBuilder('e')
      .innerJoin(MedicationSchedule, 's', 's.id = e.schedule_id')
      .where('s.profile_id IN (:...ids)', { ids })
      .andWhere('e.due_at >= :from AND e.due_at < :to', { from, to })
      .orderBy('e.due_at', 'ASC')
      .addOrderBy('e.schedule_id', 'ASC')
      .limit(MAX_EVENTS_RETURNED)
      .getMany();
    return rows.map((e) => ({
      scheduleId: e.scheduleId,
      dueAt: e.dueAt.toISOString(),
      action: e.action,
      actedAt: e.actedAt.toISOString(),
    }));
  }

  /**
   * Idempotent upsert on (schedule_id, due_at): replaying a request changes
   * nothing, and the row with the latest `actedAt` wins whatever the order.
   * One foreign schedule id rejects the whole request (404).
   */
  async recordDoseEvents(
    ctx: PatientContext,
    events: DoseEventInputDto[],
  ): Promise<{ accepted: number }> {
    const ids = this.profileIds(ctx);
    const scheduleIds = [...new Set(events.map((e) => e.scheduleId))];
    if (ids.length === 0) throw notFound();

    const owned = await this.dataSource.getRepository(MedicationSchedule).find({
      where: { id: In(scheduleIds), profileId: In(ids), hidden: false },
      select: { id: true },
    });
    if (owned.length !== scheduleIds.length) throw notFound();

    const latestAllowed = Date.now() + MAX_FUTURE_MS;
    const merged = new Map<
      string,
      DoseEventInputDto & { due: Date; acted: Date }
    >();
    for (const e of events) {
      const due = new Date(e.dueAt);
      const acted = new Date(e.actedAt);
      if (acted.getTime() > latestAllowed) {
        throw badRequest('INVALID_EVENT_TIME', 'actedAt is in the future');
      }
      const key = `${e.scheduleId}|${due.getTime()}`;
      const prev = merged.get(key);
      if (!prev || prev.acted.getTime() <= acted.getTime()) {
        merged.set(key, { ...e, due, acted });
      }
    }
    const rows = [...merged.values()];

    await this.dataSource.query(
      `INSERT INTO medication_dose_events (schedule_id, due_at, action, acted_at)
       SELECT * FROM unnest($1::uuid[], $2::timestamptz[], $3::text[], $4::timestamptz[])
       ON CONFLICT (schedule_id, due_at) DO UPDATE
         SET action = EXCLUDED.action, acted_at = EXCLUDED.acted_at
         WHERE medication_dose_events.acted_at <= EXCLUDED.acted_at`,
      [
        rows.map((r) => r.scheduleId),
        rows.map((r) => r.due.toISOString()),
        rows.map((r) => r.action),
        rows.map((r) => r.acted.toISOString()),
      ],
    );
    return { accepted: events.length };
  }

  // ── mapping ────────────────────────────────────────────────────────

  private async toDtos(
    ctx: PatientContext,
    rows: MedicationSchedule[],
  ): Promise<MedicationScheduleDto[]> {
    if (rows.length === 0) return [];
    const { clinics } = await this.clinics.visibleScope(ctx);
    return rows.map((r) =>
      r.hidden
        ? tombstone(r)
        : {
            id: r.id,
            profileId: r.profileId,
            source: r.source,
            clinic:
              (r.organizationId && clinics.get(r.organizationId)?.ref) || null,
            prescriptionId: r.prescriptionId,
            prescriptionMedicineId: r.prescriptionMedicineId,
            name: r.name,
            nameUrdu: r.nameUrdu,
            doseText: r.doseText,
            mealRelation: r.mealRelation,
            times: r.times,
            startDate: r.startDate,
            endDate: r.endDate,
            endDateSource: r.endDateSource,
            status: r.status,
            instructions: r.instructions,
            instructionsUrdu: r.instructionsUrdu,
            updatedAt: r.updatedAt.toISOString(),
          },
    );
  }
}

/**
 * A schedule the clinic cut off (A-23): only enough for an incremental client
 * to cancel its reminders. No name, dose or instructions.
 */
function tombstone(r: MedicationSchedule): MedicationScheduleDto {
  return {
    id: r.id,
    profileId: r.profileId,
    source: r.source,
    clinic: null,
    prescriptionId: null,
    prescriptionMedicineId: null,
    name: '',
    nameUrdu: null,
    doseText: '',
    mealRelation: 'NONE',
    times: [],
    startDate: r.startDate,
    endDate: r.endDate,
    endDateSource: r.endDateSource,
    status: 'stopped',
    instructions: null,
    instructionsUrdu: null,
    updatedAt: r.updatedAt.toISOString(),
  };
}
