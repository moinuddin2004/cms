import { DataSource } from 'typeorm';
import { ClockService } from 'src/common/clock/clock.service';
import { QueuePositionService } from 'src/queue/services/queue-position.service';
import type { PatientContext } from '../context/patient-context';
import { PatientClinicsService } from '../reads/patient-clinics.service';
import { PatientQueueService } from './patient-queue.service';

const clinic = (id: string) => ({
  ref: { organizationId: id, name: `Clinic ${id}`, logoUrl: null, brandColor: null, clinicStatus: 'active' },
});

function ctx(links: Partial<PatientContext['links'][number]>[]): PatientContext {
  return {
    accountId: 'acct',
    sessionId: 'sess',
    profiles: [{ id: 'prof', relation: 'self', isSelf: true }],
    links: links.map((l, i) => ({
      id: `l${i}`,
      profileId: 'prof',
      organizationId: 'org-a',
      patientId: 'pat-a',
      status: 'active' as const,
      patientAppEnabled: true,
      ...l,
    })),
  };
}

describe('PatientQueueService.subscribableSession', () => {
  it('queries by entry + account over live links at approved clinics', async () => {
    const query = jest.fn().mockResolvedValue([{ queue_session_id: 's1' }]);
    const svc = new PatientQueueService(
      { query } as unknown as DataSource,
      {} as PatientClinicsService,
      {} as QueuePositionService,
      {} as ClockService,
    );
    expect(await svc.subscribableSession('acct', 'entry')).toBe('s1');
    const [sql, params] = query.mock.calls[0];
    expect(params).toEqual(['entry', 'acct']);
    expect(sql).toContain("l.status IN ('active', 'frozen')");
    expect(sql).toContain("approval_status = 'approved'");
    expect(sql).toContain('p.account_id = $2');

    query.mockResolvedValue([]);
    expect(await svc.subscribableSession('acct', 'entry')).toBeNull();
  });
});

describe('PatientQueueService.active', () => {
  function build(entities: unknown[], scopeLinks: PatientContext) {
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['innerJoinAndSelect', 'where', 'andWhere']) {
      qb[m] = jest.fn().mockReturnValue(qb);
    }
    qb.getMany = jest.fn().mockResolvedValue(entities);
    const clinics = {
      visibleScope: jest.fn().mockResolvedValue({
        ctx: scopeLinks,
        clinics: new Map([['org-a', clinic('org-a')]]),
      }),
    };
    const positions = { positions: jest.fn().mockResolvedValue([]) };
    const dataSource = {
      getRepository: (e: { name: string }) =>
        e.name === 'Location'
          ? {
              find: async () => [{ id: 'loc', name: 'Main', timezone: 'Asia/Karachi' }],
            }
          : { createQueryBuilder: () => qb },
    } as unknown as DataSource;
    const svc = new PatientQueueService(
      dataSource,
      clinics as unknown as PatientClinicsService,
      positions as unknown as QueuePositionService,
      {
        now: () => new Date('2026-11-15T10:00:00Z'),
        today: () => '2026-11-15',
      } as unknown as ClockService,
    );
    return { svc, qb, positions };
  }

  it('is empty without visible links and never queries', async () => {
    const { svc, qb } = build([], ctx([{ organizationId: 'org-hidden' }]));
    expect(await svc.active(ctx([]))).toEqual([]);
    expect(qb.getMany).not.toHaveBeenCalled();
  });

  it('keeps only today and maps the contract shape', async () => {
    const c = ctx([{}]);
    const today = { id: 'e1', session: { locationId: 'loc', serviceDate: '2026-11-15' } };
    const yesterday = { id: 'e2', session: { locationId: 'loc', serviceDate: '2026-11-14' } };
    const { svc, positions } = build([today, yesterday], c);
    positions.positions.mockResolvedValue([
      {
        entryId: 'e1',
        organizationId: 'org-a',
        locationId: 'loc',
        patientId: 'pat-a',
        sessionId: 's1',
        serviceDate: '2026-11-15',
        token: 'A-003',
        status: 'waiting',
        doctorName: 'Dr Ali',
        peopleAhead: 2,
        nowServingToken: 'A-001',
        seq: 5,
      },
    ]);

    const out = await svc.active(c);

    expect(positions.positions).toHaveBeenCalledWith(['e1']);
    expect(out).toEqual([
      {
        entryId: 'e1',
        profileId: 'prof',
        clinic: clinic('org-a').ref,
        location: { id: 'loc', name: 'Main', timezone: 'Asia/Karachi' },
        token: 'A-003',
        status: 'waiting',
        doctorName: 'Dr Ali',
        peopleAhead: 2,
        nowServingToken: 'A-001',
        serviceDate: '2026-11-15',
      },
    ]);
  });
});
