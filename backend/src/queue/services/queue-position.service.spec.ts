import { DataSource } from 'typeorm';
import { ClockService } from 'src/common/clock/clock.service';
import { EntryStatus } from '../enums/queue.enums';
import { QueuePoliciesService } from './queue-policies.service';
import { QueuePositionService } from './queue-position.service';
import { QueueQueryService } from './queue-query.service';
import { TokenEngine } from './token-engine.service';

const session = {
  id: 's1',
  organizationId: 'org',
  locationId: 'loc',
  serviceDate: '2026-11-15',
  tokenPrefix: 'A',
  eventSeq: '9',
  doctor: { fullName: 'Dr Ali' },
};
const mk = (id: string, n: number, status: EntryStatus) => ({
  id,
  organizationId: 'org',
  patientId: `p-${id}`,
  queueSessionId: 's1',
  tokenNumber: n,
  status,
  session,
});

describe('QueuePositionService', () => {
  const entries = [
    mk('e1', 1, EntryStatus.IN_CONSULTATION),
    mk('e2', 2, EntryStatus.WAITING),
    mk('e3', 3, EntryStatus.WAITING),
    mk('e4', 4, EntryStatus.ON_HOLD),
  ];
  const service = new QueuePositionService(
    {
      getRepository: () => ({
        find: async ({ where }: { where: { id: unknown } }) => {
          void where;
          return entries;
        },
      }),
      manager: {},
    } as unknown as DataSource,
    {
      loadEntries: async () => entries,
      engineOrder: () => ({ order: ['e2', 'e3'], first: null }),
    } as unknown as QueueQueryService,
    { getEffective: async () => ({}) } as unknown as QueuePoliciesService,
    { format: (p: string, n: number) => `${p}-${String(n).padStart(3, '0')}` } as unknown as TokenEngine,
    { now: () => new Date('2026-11-15T10:00:00Z') } as unknown as ClockService,
  );

  it('computes token, place and who is being served — nothing about other patients', async () => {
    const out = await service.positions(['e1', 'e2', 'e3', 'e4']);
    const by = Object.fromEntries(out.map((p) => [p.entryId, p]));
    expect(by.e1).toMatchObject({ peopleAhead: 0, token: 'A-001', nowServingToken: 'A-001' });
    expect(by.e2).toMatchObject({ peopleAhead: 0 + 0, token: 'A-002' });
    expect(by.e3).toMatchObject({ peopleAhead: 1, token: 'A-003', doctorName: 'Dr Ali', seq: 9 });
    expect(by.e4.peopleAhead).toBeNull();
    expect(Object.keys(by.e3)).not.toContain('patientName');
  });

  it('returns nothing for no ids', async () => {
    expect(await service.positions([])).toEqual([]);
  });
});
