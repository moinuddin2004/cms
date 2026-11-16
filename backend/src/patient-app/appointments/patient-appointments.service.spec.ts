import { ConflictException, NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { AuditService } from 'src/common/audit/audit.service';
import type { ClockService } from 'src/common/clock/clock.service';
import type { PatientContext } from '../context/patient-context';
import type { PatientClinicsService } from '../reads/patient-clinics.service';
import { PatientAppointmentsService } from './patient-appointments.service';

const ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-11-16T10:00:00Z');

const ctx: PatientContext = {
  accountId: 'acc',
  sessionId: 's',
  profiles: [{ id: 'p1', relation: 'self', isSelf: true }],
  links: [
    {
      id: 'l1',
      profileId: 'p1',
      organizationId: 'org-1',
      patientId: 'pat-1',
      status: 'active',
      patientAppEnabled: true,
    },
    {
      id: 'l2',
      profileId: 'p1',
      organizationId: 'org-2',
      patientId: 'pat-2',
      status: 'frozen',
      patientAppEnabled: true,
    },
  ],
};

function build(row: Record<string, unknown> | undefined) {
  const wheres: string[] = [];
  const params: Record<string, unknown> = {};
  const qb: Record<string, unknown> = {
    expressionMap: { mainAlias: { name: 'a' } },
    select: () => qb,
    from: () => qb,
    setLock: () => qb,
    where: (s: string, p?: object) => {
      wheres.push(s);
      Object.assign(params, p);
      return qb;
    },
    andWhere: (s: string, p?: object) => {
      wheres.push(s);
      Object.assign(params, p);
      return qb;
    },
    getRawOne: () => Promise.resolve(row),
  };
  const query = jest.fn().mockResolvedValue(undefined);
  const manager = { createQueryBuilder: () => qb, query };
  const dataSource = {
    transaction: (fn: (m: unknown) => unknown) => fn(manager),
  } as unknown as DataSource;
  const clinics = {
    visibleScope: (c: PatientContext) =>
      Promise.resolve({
        ctx: c,
        clinics: new Map([
          ['org-1', { ref: { clinicStatus: 'active' } }],
          ['org-2', { ref: { clinicStatus: 'active' } }],
        ]),
      }),
  } as unknown as PatientClinicsService;
  const record = jest.fn().mockResolvedValue(true);
  const service = new PatientAppointmentsService(
    dataSource,
    clinics,
    { record } as unknown as AuditService,
    { now: () => NOW } as unknown as ClockService,
  );
  return { service, wheres, params, query, record };
}

const base = {
  id: ID,
  organizationId: 'org-1',
  patientId: 'pat-1',
  status: 'scheduled',
  startTime: '2026-11-20T09:00:00Z',
  patientConfirmedAt: null,
};

describe('PatientAppointmentsService.confirm (M3-08)', () => {
  it('confirms a future scheduled appointment and audits it', async () => {
    const { service, query, record } = build(base);
    const out = await service.confirm(ctx, ID);
    expect(out).toEqual({ id: ID, patientConfirmedAt: NOW.toISOString() });
    expect(query).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('is scoped through active links only (frozen link excluded)', async () => {
    const { service, params } = build(base);
    await service.confirm(ctx, ID);
    const values = Object.values(params);
    expect(values).toContain('org-1');
    expect(values).not.toContain('org-2');
  });

  it('is idempotent: second confirm returns the first timestamp, no write', async () => {
    const first = '2026-11-15T08:00:00.000Z';
    const { service, query, record } = build({
      ...base,
      patientConfirmedAt: first,
    });
    const out = await service.confirm(ctx, ID);
    expect(out.patientConfirmedAt).toBe(first);
    expect(query).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('404s when the appointment is not in the caller scope', async () => {
    const { service } = build(undefined);
    await expect(service.confirm(ctx, ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('404s on a malformed id without touching the database', async () => {
    const { service, query } = build(base);
    await expect(service.confirm(ctx, 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    ['past', { startTime: '2026-11-10T09:00:00Z' }],
    ['cancelled', { status: 'cancelled' }],
    ['checked in', { status: 'checked_in' }],
  ])('409s for a %s appointment', async (_n, patch) => {
    const { service, query } = build({ ...base, ...patch });
    await expect(service.confirm(ctx, ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(query).not.toHaveBeenCalled();
  });
});
