import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { MedicationDoseEvent } from 'src/medications/entities/medication-dose-event.entity';
import { MedicationSchedule } from 'src/medications/entities/medication-schedule.entity';
import type { PatientContext } from '../context/patient-context';
import type { PatientClinicsService } from '../reads/patient-clinics.service';
import { PatientMedicationsService } from './patient-medications.service';

const SCHED_A = '11111111-1111-4111-8111-111111111111';
const SCHED_B = '22222222-2222-4222-8222-222222222222';
const FOREIGN = '33333333-3333-4333-8333-333333333333';
const PROFILE_1 = '44444444-4444-4444-8444-444444444444';
const PROFILE_2 = '55555555-5555-4555-8555-555555555555';
const OTHER_PROFILE = '66666666-6666-4666-8666-666666666666';

const ctx: PatientContext = {
  accountId: 'acc-1',
  sessionId: 's-1',
  profiles: [
    { id: PROFILE_1, relation: 'self', isSelf: true },
    { id: PROFILE_2, relation: 'child', isSelf: false },
  ],
  links: [
    {
      id: 'l1',
      profileId: PROFILE_1,
      organizationId: 'org-1',
      patientId: 'pat-1',
      status: 'active',
      patientAppEnabled: true,
    },
  ],
};

const emptyCtx: PatientContext = { ...ctx, profiles: [] };

/** Pull the ids out of a typeorm `In(...)` FindOperator. */
const idsOf = (op: unknown): string[] => (op as { value: string[] }).value;

function schedule(over: Partial<MedicationSchedule> = {}): MedicationSchedule {
  return {
    id: SCHED_A,
    profileId: PROFILE_1,
    source: 'prescription',
    organizationId: 'org-1',
    prescriptionId: 'rx-1',
    prescriptionMedicineId: 'm-1',
    name: 'Amoxicillin',
    nameUrdu: null,
    doseText: '500 mg',
    times: ['08:00', '20:00'],
    mealRelation: 'AFTER_MEAL',
    startDate: '2026-11-15',
    endDate: '2026-11-19',
    endDateSource: 'parsed',
    status: 'active',
    instructions: null,
    instructionsUrdu: null,
    patientEdited: false,
    prescriptionVersion: 1,
    hidden: false,
    createdAt: new Date('2026-11-15T07:00:00Z'),
    updatedAt: new Date('2026-11-15T07:00:00Z'),
    ...over,
  };
}

function build(opts: {
  schedules?: MedicationSchedule[];
  events?: MedicationDoseEvent[];
}) {
  const calls = {
    find: [] as any[],
    findOne: [] as any[],
    saved: [] as MedicationSchedule[],
    queries: [] as { sql: string; params: unknown[][] }[],
    eventWheres: [] as { sql: string; params: Record<string, unknown> }[],
  };
  const schedules = opts.schedules ?? [];
  const scheduleRepo = {
    find: async (arg: any) => {
      calls.find.push(arg);
      const ids = idsOf(arg.where.profileId);
      const idFilter = arg.where.id ? idsOf(arg.where.id) : null;
      return schedules
        .filter(
          (s) =>
            ids.includes(s.profileId) &&
            (!idFilter || idFilter.includes(s.id)) &&
            (arg.where.hidden === undefined || s.hidden === arg.where.hidden),
        )
        .slice(0, arg.take ?? 1e9);
    },
    findOne: async (arg: any) => {
      calls.findOne.push(arg);
      const ids = idsOf(arg.where.profileId);
      return (
        schedules.find(
          (s) =>
            s.id === arg.where.id &&
            ids.includes(s.profileId) &&
            (arg.where.hidden === undefined || s.hidden === arg.where.hidden),
        ) ??
        null
      );
    },
    save: async (row: MedicationSchedule) => {
      calls.saved.push({ ...row });
      return row;
    },
  };
  const qb: any = {
    innerJoin: () => qb,
    where: (sql: string, params: Record<string, unknown>) => {
      calls.eventWheres.push({ sql, params });
      return qb;
    },
    andWhere: (sql: string, params: Record<string, unknown>) => {
      calls.eventWheres.push({ sql, params });
      return qb;
    },
    orderBy: () => qb,
    addOrderBy: () => qb,
    limit: () => qb,
    getMany: async () => opts.events ?? [],
  };
  const dataSource = {
    getRepository: (entity: unknown) => {
      if (entity === MedicationSchedule) return scheduleRepo;
      if (entity === MedicationDoseEvent) return { createQueryBuilder: () => qb };
      throw new Error('unexpected repo');
    },
    query: async (sql: string, ...params: unknown[][]) => {
      calls.queries.push({ sql, params });
      return [];
    },
  } as unknown as DataSource;
  const clinics = {
    visibleScope: async () => ({
      ctx,
      clinics: new Map([
        [
          'org-1',
          {
            ref: {
              organizationId: 'org-1',
              name: 'Smile Clinic',
              logoUrl: null,
              brandColor: null,
              clinicStatus: 'active',
            },
          },
        ],
      ]),
    }),
  } as unknown as PatientClinicsService;
  return { svc: new PatientMedicationsService(dataSource, clinics), calls };
}

describe('PatientMedicationsService.list', () => {
  it('scopes to the account profiles and maps an explicit DTO', async () => {
    const { svc, calls } = build({ schedules: [schedule(), schedule({ id: SCHED_B, profileId: OTHER_PROFILE })] });
    const { items: out, nextUpdatedSince } = await svc.list(ctx, {});
    expect(nextUpdatedSince).toBeNull();
    expect(idsOf(calls.find[0].where.profileId).sort()).toEqual([PROFILE_1, PROFILE_2].sort());
    expect(out).toHaveLength(1);
    expect(Object.keys(out[0]).sort()).toEqual(
      [
        'clinic', 'doseText', 'endDate', 'endDateSource', 'id', 'instructions',
        'instructionsUrdu', 'mealRelation', 'name', 'nameUrdu', 'prescriptionId',
        'prescriptionMedicineId', 'profileId', 'source', 'startDate', 'status',
        'times', 'updatedAt',
      ].sort(),
    );
    expect(out[0].clinic?.name).toBe('Smile Clinic');
    expect(out[0].updatedAt).toBe('2026-11-15T07:00:00.000Z');
  });

  it('a profile filter must be the caller\'s own (404 otherwise)', async () => {
    const { svc } = build({});
    await expect(svc.list(ctx, { profileId: OTHER_PROFILE })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('narrows to one profile when asked', async () => {
    const { svc, calls } = build({ schedules: [schedule()] });
    await svc.list(ctx, { profileId: PROFILE_1 });
    expect(idsOf(calls.find[0].where.profileId)).toEqual([PROFILE_1]);
  });

  it('applies updatedSince', async () => {
    const { svc, calls } = build({ schedules: [] });
    await svc.list(ctx, { updatedSince: '2026-11-15T00:00:00Z' });
    expect(calls.find[0].where.updatedAt).toBeDefined();
  });

  it('returns nothing without profiles and never queries', async () => {
    const { svc, calls } = build({ schedules: [schedule()] });
    expect(await svc.list(emptyCtx, {})).toEqual({ items: [], nextUpdatedSince: null });
    expect(calls.find).toHaveLength(0);
  });

  it('clinic is null when the clinic is not visible', async () => {
    const { svc } = build({ schedules: [schedule({ organizationId: 'org-gone' })] });
    expect((await svc.list(ctx, {})).items[0].clinic).toBeNull();
  });
});

describe('PatientMedicationsService.list paging and hidden rows', () => {
  it('orders oldest change first and returns a cursor when the cap is hit', async () => {
    const many = Array.from({ length: 501 }, (_, i) =>
      schedule({
        id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        updatedAt: new Date(Date.UTC(2026, 10, 15, 0, 0, i)),
      }),
    );
    const { svc, calls } = build({ schedules: many });
    const out = await svc.list(ctx, {});
    expect(calls.find[0].order).toEqual({ updatedAt: 'ASC', id: 'ASC' });
    expect(calls.find[0].take).toBe(501);
    expect(out.items).toHaveLength(500);
    expect(out.nextUpdatedSince).toBe(out.items[499].updatedAt);
  });

  it('hides clinic-revoked rows from the full list but sends them as tombstones with updatedSince', async () => {
    const hidden = schedule({ id: SCHED_B, hidden: true, status: 'stopped' });
    const { svc } = build({ schedules: [schedule(), hidden] });
    expect((await svc.list(ctx, {})).items.map((i) => i.id)).toEqual([SCHED_A]);
    const incremental = await svc.list(ctx, { updatedSince: '2026-11-01T00:00:00Z' });
    expect(incremental.items.map((i) => i.id).sort()).toEqual([SCHED_A, SCHED_B].sort());
  });
});

describe('PatientMedicationsService.patch', () => {
  it('a hidden (clinic-revoked) schedule is a 404', async () => {
    const { svc } = build({ schedules: [schedule({ hidden: true })] });
    await expect(svc.patch(ctx, SCHED_A, { status: 'paused' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('is read-only (403) once the link is gone or the patient app is off', async () => {
    const { svc } = build({ schedules: [schedule()] });
    const noLink = { ...ctx, links: [] };
    await expect(svc.patch(noLink, SCHED_A, { status: 'paused' })).rejects.toMatchObject({
      response: { code: 'PATIENT_APP_DISABLED' },
    });
    const off = { ...ctx, links: [{ ...ctx.links[0], patientAppEnabled: false }] };
    await expect(svc.patch(off, SCHED_A, { status: 'paused' })).rejects.toMatchObject({
      response: { code: 'PATIENT_APP_DISABLED' },
    });
    const frozen = { ...ctx, links: [{ ...ctx.links[0], status: 'frozen' as const }] };
    await expect(svc.patch(frozen, SCHED_A, { status: 'paused' })).rejects.toMatchObject({
      response: { code: 'PATIENT_APP_DISABLED' },
    });
  });

  it('updates times (sorted, unique), end date, status and marks patient edited', async () => {
    const { svc, calls } = build({ schedules: [schedule()] });
    const out = await svc.patch(ctx, SCHED_A, {
      times: ['20:00', '09:00', '09:00'],
      endDate: '2026-12-01',
      status: 'paused',
    });
    expect(out).toMatchObject({
      times: ['09:00', '20:00'],
      endDate: '2026-12-01',
      endDateSource: 'patient',
      status: 'paused',
    });
    expect(calls.saved[0].patientEdited).toBe(true);
  });

  it('null endDate means "no end", decided by the patient', async () => {
    const { svc } = build({ schedules: [schedule()] });
    const out = await svc.patch(ctx, SCHED_A, { endDate: null });
    expect(out).toMatchObject({ endDate: null, endDateSource: 'patient' });
  });

  it('refuses a schedule of another account with a plain 404', async () => {
    const { svc, calls } = build({ schedules: [schedule({ profileId: OTHER_PROFILE })] });
    await expect(svc.patch(ctx, SCHED_A, { status: 'paused' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(calls.saved).toHaveLength(0);
  });

  it('404 for a malformed id and for an account with no profiles', async () => {
    const { svc } = build({ schedules: [schedule()] });
    await expect(svc.patch(ctx, 'nope', { status: 'paused' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.patch(emptyCtx, SCHED_A, { status: 'paused' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an empty patch', async () => {
    const { svc } = build({ schedules: [schedule()] });
    await expect(svc.patch(ctx, SCHED_A, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['2026-02-30', '2026-11-14'])('rejects end date %s', async (endDate) => {
    const { svc } = build({ schedules: [schedule()] });
    await expect(svc.patch(ctx, SCHED_A, { endDate })).rejects.toMatchObject({
      response: { code: 'INVALID_END_DATE' },
    });
  });
});

describe('PatientMedicationsService dose events', () => {
  const ev = (over: Record<string, string> = {}) => ({
    scheduleId: SCHED_A,
    dueAt: '2026-11-15T03:00:00.000Z',
    action: 'taken' as const,
    actedAt: '2026-11-15T03:05:00.000Z',
    ...over,
  });

  it('upserts on (schedule_id, due_at) keeping the latest actedAt', async () => {
    const { svc, calls } = build({ schedules: [schedule()] });
    const out = await svc.recordDoseEvents(ctx, [ev()]);
    expect(out).toEqual({ accepted: 1 });
    const { sql, params } = calls.queries[0];
    expect(sql).toContain('ON CONFLICT (schedule_id, due_at) DO UPDATE');
    expect(sql).toContain('medication_dose_events.acted_at <= EXCLUDED.acted_at');
    expect(params[0]).toEqual([[SCHED_A], ['2026-11-15T03:00:00.000Z'], ['taken'], ['2026-11-15T03:05:00.000Z']]);
  });

  it('collapses duplicates inside one request to the latest action', async () => {
    const { svc, calls } = build({ schedules: [schedule()] });
    const out = await svc.recordDoseEvents(ctx, [
      ev({ action: 'skipped', actedAt: '2026-11-15T03:10:00.000Z' }),
      ev({ action: 'taken', actedAt: '2026-11-15T03:05:00.000Z' }),
    ]);
    expect(out).toEqual({ accepted: 2 });
    const params = calls.queries[0].params[0] as unknown[][];
    expect(params[2]).toEqual(['skipped']);
    expect(params[0]).toHaveLength(1);
  });

  it('is replay-safe: the same request twice issues the same idempotent statement', async () => {
    const { svc, calls } = build({ schedules: [schedule()] });
    await svc.recordDoseEvents(ctx, [ev()]);
    await svc.recordDoseEvents(ctx, [ev()]);
    expect(calls.queries[1]).toEqual(calls.queries[0]);
  });

  it('one foreign schedule id rejects the whole batch (404, nothing written)', async () => {
    const { svc, calls } = build({ schedules: [schedule()] });
    await expect(
      svc.recordDoseEvents(ctx, [ev(), ev({ scheduleId: FOREIGN })]),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(calls.queries).toHaveLength(0);
  });

  it('a schedule of another account is a foreign id', async () => {
    const { svc } = build({ schedules: [schedule({ profileId: OTHER_PROFILE })] });
    await expect(svc.recordDoseEvents(ctx, [ev()])).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses an actedAt more than a day in the future', async () => {
    const { svc, calls } = build({ schedules: [schedule()] });
    const future = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    await expect(svc.recordDoseEvents(ctx, [ev({ actedAt: future })])).rejects.toMatchObject({
      response: { code: 'INVALID_EVENT_TIME' },
    });
    expect(calls.queries).toHaveLength(0);
  });

  it('lists events of own profiles in a window, as an explicit DTO', async () => {
    const event = Object.assign(new MedicationDoseEvent(), {
      id: 'e1',
      scheduleId: SCHED_A,
      dueAt: new Date('2026-11-15T03:00:00Z'),
      action: 'taken',
      actedAt: new Date('2026-11-15T03:05:00Z'),
      createdAt: new Date(),
    });
    const { svc, calls } = build({ events: [event] });
    const out = await svc.listDoseEvents(ctx, {
      from: '2026-11-15T00:00:00Z',
      to: '2026-11-16T00:00:00Z',
    });
    expect(out).toEqual([
      {
        scheduleId: SCHED_A,
        dueAt: '2026-11-15T03:00:00.000Z',
        action: 'taken',
        actedAt: '2026-11-15T03:05:00.000Z',
      },
    ]);
    expect(calls.eventWheres[0].params.ids).toEqual([PROFILE_1, PROFILE_2]);
  });

  it('validates the window', async () => {
    const { svc } = build({});
    await expect(
      svc.listDoseEvents(ctx, { from: '2026-11-16T00:00:00Z', to: '2026-11-15T00:00:00Z' }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_RANGE' } });
    await expect(
      svc.listDoseEvents(ctx, { from: '2026-01-01T00:00:00Z', to: '2026-11-15T00:00:00Z' }),
    ).rejects.toMatchObject({ response: { code: 'RANGE_TOO_LARGE' } });
  });

  it('a foreign profileId filter is a 404', async () => {
    const { svc } = build({});
    await expect(
      svc.listDoseEvents(ctx, {
        profileId: OTHER_PROFILE,
        from: '2026-11-15T00:00:00Z',
        to: '2026-11-16T00:00:00Z',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
